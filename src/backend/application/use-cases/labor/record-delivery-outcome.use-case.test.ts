/**
 * Record Delivery Outcome Use Case Tests
 */

import { RecordDeliveryOutcomeUseCase } from './record-delivery-outcome.use-case';
import { NotificationService } from '../../services/notification.service';
import { getPatientIdGenerator } from '../../../infrastructure/generators/patient-id.generator';
import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors/AppError';

jest.mock('../../services/notification.service');
jest.mock('../../../infrastructure/generators/patient-id.generator');

describe('RecordDeliveryOutcomeUseCase', () => {
  let useCase: RecordDeliveryOutcomeUseCase;
  let mockPrisma: any;
  let mockTx: any;
  let mockNotifyRole: jest.Mock;

  const tenantId = 'tenant-1';
  const laborRecordId = 'labor-1';
  const deliveredById = 'user-1';

  const baseLaborRecord = {
    id: laborRecordId,
    tenantId,
    patientId: 'mother-1',
    pregnancyId: null,
    status: 'IN_LABOR',
    patient: { id: 'mother-1', firstName: 'Jane', lastName: 'Doe', address: null, city: null, state: null, lga: null, phone: '08011112222' },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      patient: { create: jest.fn() },
      nextOfKin: { create: jest.fn() },
      patientInsurance: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      laborRecord: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      ancPregnancy: { update: jest.fn() },
    };

    mockPrisma = {
      laborRecord: { findFirst: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(mockTx)),
    };

    (getPatientIdGenerator as jest.Mock).mockReturnValue({
      generatePatientId: jest.fn().mockResolvedValue('PT-2026-0099'),
    });

    useCase = new RecordDeliveryOutcomeUseCase(mockPrisma);

    mockNotifyRole = (NotificationService as unknown as jest.Mock).mock.instances[0].notifyRole as jest.Mock;
    mockNotifyRole.mockResolvedValue(undefined);
  });

  it('throws NotFoundError when the labor record does not exist', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH' }, deliveredById)).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the labor record is not IN_LABOR', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    await expect(useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH' }, deliveredById)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when registering a newborn without babySex', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);

    await expect(useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH' }, deliveredById)).rejects.toThrow(ValidationError);
  });

  it('registers the newborn as a patient with a synthetic phone and mother linkage on a live birth', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.patient.create.mockResolvedValue({ id: 'newborn-1', patientId: 'PT-2026-0099' });
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED', newbornPatientId: 'newborn-1' });

    const result = await useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE' }, deliveredById);

    expect(mockTx.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        firstName: 'Baby',
        lastName: 'Doe',
        gender: 'FEMALE',
        motherPatientId: 'mother-1',
        phone: expect.stringMatching(/^NEWBORN-[0-9A-F]{8}$/),
      }),
    });
    expect(mockTx.nextOfKin.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ patientId: 'newborn-1', relationship: 'MOTHER', phoneNumber: '08011112222' }),
    });
    expect(mockTx.laborRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ newbornPatientId: 'newborn-1' }) })
    );
    expect(result.newbornPatient).toEqual({ id: 'newborn-1', patientId: 'PT-2026-0099' });
  });

  it('clones the mother\'s active insurance onto the newborn', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.patient.create.mockResolvedValue({ id: 'newborn-1', patientId: 'PT-2026-0099' });
    mockTx.patientInsurance.findMany.mockResolvedValue([
      { providerId: 'provider-1', policyNumber: 'POL-1', groupNumber: 'GRP-1', planType: 'STANDARD', copayPercentage: 10, validTo: new Date('2027-01-01') },
    ]);
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    await useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE' }, deliveredById);

    expect(mockTx.patientInsurance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: 'mother-1', isActive: true }) })
    );
    expect(mockTx.patientInsurance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ patientId: 'newborn-1', providerId: 'provider-1', policyNumber: 'POL-1', isActive: true }),
    });
  });

  it('does not clone insurance when the mother has none active', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.patient.create.mockResolvedValue({ id: 'newborn-1', patientId: 'PT-2026-0099' });
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    await useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE' }, deliveredById);

    expect(mockTx.patientInsurance.create).not.toHaveBeenCalled();
  });

  it('uses the 1000ml cesarean PPH threshold instead of the 500ml vaginal one', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    await useCase.execute(
      tenantId,
      laborRecordId,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE', registerNewbornAsPatient: false, modeOfDelivery: 'CESAREAN_SECTION', estimatedBloodLossMl: 700 },
      deliveredById
    );

    expect(mockNotifyRole).not.toHaveBeenCalled();

    await useCase.execute(
      tenantId,
      laborRecordId,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE', registerNewbornAsPatient: false, modeOfDelivery: 'CESAREAN_SECTION', estimatedBloodLossMl: 1200 },
      deliveredById
    );

    expect(mockNotifyRole).toHaveBeenCalledWith(
      tenantId,
      ['DOCTOR', 'NURSE'],
      expect.objectContaining({ message: expect.stringContaining('threshold 1000ml') })
    );
  });

  it('skips newborn registration when registerNewbornAsPatient is false', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    const result = await useCase.execute(
      tenantId,
      laborRecordId,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE', registerNewbornAsPatient: false },
      deliveredById
    );

    expect(mockTx.patient.create).not.toHaveBeenCalled();
    expect(result.newbornPatient).toBeUndefined();
  });

  it('closes the linked pregnancy when one is attached', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue({ ...baseLaborRecord, pregnancyId: 'preg-1' });
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    const result = await useCase.execute(
      tenantId,
      laborRecordId,
      { babyOutcome: 'STILLBIRTH_FRESH', registerNewbornAsPatient: false },
      deliveredById
    );

    expect(mockTx.ancPregnancy.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'preg-1' }, data: expect.objectContaining({ isActive: false, outcome: 'STILLBIRTH_FRESH' }) })
    );
    expect(result.pregnancyClosed).toBe(true);
  });

  it('notifies DOCTOR/NURSE on possible PPH, stillbirth, low APGAR, and resuscitation', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    await useCase.execute(
      tenantId,
      laborRecordId,
      {
        babyOutcome: 'LIVE_BIRTH',
        babySex: 'MALE',
        registerNewbornAsPatient: false,
        estimatedBloodLossMl: 600,
        apgarScore5Min: 5,
        resuscitationRequired: true,
      },
      deliveredById
    );

    expect(mockNotifyRole).toHaveBeenCalledWith(
      tenantId,
      ['DOCTOR', 'NURSE'],
      expect.objectContaining({ type: 'DELIVERY_ALERT', entityType: 'LaborRecord', entityId: laborRecordId })
    );
    const message = mockNotifyRole.mock.calls[0][2].message;
    expect(message).toContain('possible PPH');
    expect(message).toContain('APGAR score 5 is low');
    expect(message).toContain('resuscitation was required');
  });

  it('throws ConflictError when a concurrent request already recorded this delivery, without registering a duplicate newborn', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.laborRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      useCase.execute(tenantId, laborRecordId, { babyOutcome: 'LIVE_BIRTH', babySex: 'FEMALE' }, deliveredById)
    ).rejects.toThrow(ConflictError);

    expect(mockTx.patient.create).not.toHaveBeenCalled();
  });

  it('does not notify when the outcome is unremarkable', async () => {
    mockPrisma.laborRecord.findFirst.mockResolvedValue(baseLaborRecord);
    mockTx.laborRecord.update.mockResolvedValue({ ...baseLaborRecord, status: 'DELIVERED' });

    await useCase.execute(
      tenantId,
      laborRecordId,
      { babyOutcome: 'LIVE_BIRTH', babySex: 'MALE', registerNewbornAsPatient: false, estimatedBloodLossMl: 150, apgarScore5Min: 9 },
      deliveredById
    );

    expect(mockNotifyRole).not.toHaveBeenCalled();
  });
});

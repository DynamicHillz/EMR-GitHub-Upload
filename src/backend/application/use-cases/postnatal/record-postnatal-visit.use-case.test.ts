/**
 * Record Postnatal Visit Use Case Tests
 */

import { RecordPostnatalVisitUseCase } from './record-postnatal-visit.use-case';
import { NotificationService } from '../../services/notification.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

jest.mock('../../services/notification.service');

describe('RecordPostnatalVisitUseCase', () => {
  let useCase: RecordPostnatalVisitUseCase;
  let mockPrisma: any;
  let mockNotifyRole: jest.Mock;

  const tenantId = 'tenant-1';
  const patientId = 'mother-1';
  const recordedById = 'user-1';
  const patient = { id: patientId, firstName: 'Jane', lastName: 'Doe' };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      patient: { findFirst: jest.fn().mockResolvedValue(patient) },
      ancPregnancy: { findFirst: jest.fn() },
      postnatalVisit: { create: jest.fn().mockResolvedValue({ id: 'visit-1' }) },
    };

    useCase = new RecordPostnatalVisitUseCase(mockPrisma);

    mockNotifyRole = (NotificationService as unknown as jest.Mock).mock.instances[0].notifyRole as jest.Mock;
    mockNotifyRole.mockResolvedValue(undefined);
  });

  it('throws NotFoundError when the patient does not exist for this tenant', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, patientId, { contactType: 'PNC_24H' }, recordedById)).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when the pregnancyId does not belong to the patient', async () => {
    mockPrisma.ancPregnancy.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(tenantId, patientId, { contactType: 'PNC_24H', pregnancyId: 'preg-x' }, recordedById)
    ).rejects.toThrow(ValidationError);
  });

  it('creates the visit with the given fields', async () => {
    await useCase.execute(
      tenantId,
      patientId,
      { contactType: 'PNC_WEEK1', maternalSystolicBP: 118, breastfeedingStatus: 'EXCLUSIVE' },
      recordedById
    );

    expect(mockPrisma.postnatalVisit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId,
        patientId,
        contactType: 'PNC_WEEK1',
        recordedById,
        maternalSystolicBP: 118,
        breastfeedingStatus: 'EXCLUSIVE',
        newbornDangerSigns: [],
      }),
    });
  });

  it('notifies DOCTOR/NURSE on maternal and newborn danger signs', async () => {
    await useCase.execute(
      tenantId,
      patientId,
      {
        contactType: 'PNC_DAY3',
        maternalSystolicBP: 150,
        lochiaStatus: 'OFFENSIVE',
        newbornFeedingWell: false,
        jaundiceObserved: true,
      },
      recordedById
    );

    expect(mockNotifyRole).toHaveBeenCalledWith(
      tenantId,
      ['DOCTOR', 'NURSE'],
      expect.objectContaining({ type: 'POSTNATAL_VISIT_ALERT', entityType: 'PostnatalVisit', entityId: 'visit-1' })
    );
    const message = mockNotifyRole.mock.calls[0][2].message;
    expect(message).toContain('blood pressure is elevated');
    expect(message).toContain('offensive');
    expect(message).toContain('not feeding well');
    expect(message).toContain('jaundice observed');
  });

  it('does not notify when nothing is abnormal', async () => {
    await useCase.execute(tenantId, patientId, { contactType: 'PNC_WEEK6', maternalSystolicBP: 118 }, recordedById);

    expect(mockNotifyRole).not.toHaveBeenCalled();
  });
});

/**
 * Insurance Controller Tests
 *
 * updateClaimStatus: covers the PAID transition — settlement (paidAmount/
 * paidAt) is stamped on the InsuranceClaim itself, not via Invoice/Payment
 * (Invoice.balance already excludes the insurance-covered portion at
 * generation time, see generate-invoice.use-case.ts) — and idempotency:
 * re-saving an already-PAID claim must not reset its paid timestamp.
 *
 * updatePatientInsurance: covers the legacy copay-enrollment edit/deactivate
 * endpoint — tenant+patient scoping on the lookup, and that it's a genuine
 * partial update (only provided fields change).
 */

const mockPrismaInstance = {
  insuranceClaim: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  patientInsurance: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaInstance),
}));

import { InsuranceController } from './insurance.controller';

describe('InsuranceController.updateClaimStatus', () => {
  let controller: InsuranceController;
  let next: jest.Mock;

  const tenantId = 'tenant-1';
  const claimId = 'claim-1';

  const mockReq = (body: any) => ({ params: { id: claimId }, body, user: { tenantId } } as any);
  const mockRes = () => {
    const res: any = {};
    res.json = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  const approvedClaim = {
    id: claimId,
    tenantId,
    status: 'APPROVED',
    amountClaimed: 10000,
    amountApproved: 8000,
    submittedAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InsuranceController();
    next = jest.fn();
  });

  it('stamps paidAmount and paidAt when a claim newly transitions to PAID', async () => {
    mockPrismaInstance.insuranceClaim.findFirst.mockResolvedValue(approvedClaim);
    mockPrismaInstance.insuranceClaim.update.mockResolvedValue({ ...approvedClaim, status: 'PAID' });

    const res = mockRes();
    await controller.updateClaimStatus(mockReq({ status: 'PAID', amountApproved: 8000 }), res, next);

    expect(next).not.toHaveBeenCalled();
    const updateCall = mockPrismaInstance.insuranceClaim.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: claimId });
    expect(updateCall.data.status).toBe('PAID');
    expect(updateCall.data.paidAmount).toBe(8000);
    expect(updateCall.data.paidAt).toBeInstanceOf(Date);
    expect(res.json).toHaveBeenCalledWith({ ...approvedClaim, status: 'PAID' });
  });

  it('falls back to amountClaimed for paidAmount when nothing was ever approved', async () => {
    mockPrismaInstance.insuranceClaim.findFirst.mockResolvedValue({
      ...approvedClaim,
      amountApproved: null,
    });
    mockPrismaInstance.insuranceClaim.update.mockResolvedValue({});

    await controller.updateClaimStatus(mockReq({ status: 'PAID' }), mockRes(), next);

    const updateCall = mockPrismaInstance.insuranceClaim.update.mock.calls[0][0];
    expect(updateCall.data.paidAmount).toBe(10000); // amountClaimed
  });

  it('does not reset paidAt when re-saving a claim that is already PAID', async () => {
    mockPrismaInstance.insuranceClaim.findFirst.mockResolvedValue({
      ...approvedClaim,
      status: 'PAID',
      paidAmount: 8000,
      paidAt: new Date('2026-06-05T00:00:00.000Z'),
    });
    mockPrismaInstance.insuranceClaim.update.mockResolvedValue({});

    await controller.updateClaimStatus(mockReq({ status: 'PAID', amountApproved: 8000 }), mockRes(), next);

    const updateCall = mockPrismaInstance.insuranceClaim.update.mock.calls[0][0];
    expect(updateCall.data.paidAmount).toBeUndefined();
    expect(updateCall.data.paidAt).toBeUndefined();
  });

  it('does not set paidAmount/paidAt for a non-PAID status transition', async () => {
    mockPrismaInstance.insuranceClaim.findFirst.mockResolvedValue(approvedClaim);
    mockPrismaInstance.insuranceClaim.update.mockResolvedValue({});

    await controller.updateClaimStatus(mockReq({ status: 'DENIED', denialReason: 'Not covered' }), mockRes(), next);

    const updateCall = mockPrismaInstance.insuranceClaim.update.mock.calls[0][0];
    expect(updateCall.data.paidAmount).toBeUndefined();
    expect(updateCall.data.paidAt).toBeUndefined();
    expect(updateCall.data.denialReason).toBe('Not covered');
    expect(updateCall.data.adjudicatedAt).toBeInstanceOf(Date);
  });

  it('passes NotFoundError to next when the claim does not exist for the tenant', async () => {
    mockPrismaInstance.insuranceClaim.findFirst.mockResolvedValue(null);

    await controller.updateClaimStatus(mockReq({ status: 'PAID' }), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(mockPrismaInstance.insuranceClaim.update).not.toHaveBeenCalled();
  });
});

describe('InsuranceController.updatePatientInsurance', () => {
  let controller: InsuranceController;
  let next: jest.Mock;

  const tenantId = 'tenant-1';
  const patientId = 'patient-1';
  const policyId = 'policy-1';

  const mockReq = (body: any) => ({ params: { patientId, policyId }, body, user: { tenantId } } as any);
  const mockRes = () => {
    const res: any = {};
    res.json = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  const existingPolicy = {
    id: policyId,
    tenantId,
    patientId,
    providerId: 'provider-1',
    policyNumber: 'POL-001',
    groupNumber: null,
    planType: 'STANDARD',
    copayPercentage: 20,
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InsuranceController();
    next = jest.fn();
  });

  it('scopes the lookup by tenantId and patientId, not just the policy id', async () => {
    mockPrismaInstance.patientInsurance.findFirst.mockResolvedValue(existingPolicy);
    mockPrismaInstance.patientInsurance.update.mockResolvedValue(existingPolicy);

    await controller.updatePatientInsurance(mockReq({ isActive: false }), mockRes(), next);

    expect(mockPrismaInstance.patientInsurance.findFirst).toHaveBeenCalledWith({
      where: { id: policyId, tenantId, patientId },
    });
  });

  it('deactivates a policy without touching its other fields', async () => {
    mockPrismaInstance.patientInsurance.findFirst.mockResolvedValue(existingPolicy);
    mockPrismaInstance.patientInsurance.update.mockResolvedValue({ ...existingPolicy, isActive: false });

    const res = mockRes();
    await controller.updatePatientInsurance(mockReq({ isActive: false }), res, next);

    const updateCall = mockPrismaInstance.patientInsurance.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: policyId });
    expect(updateCall.data).toEqual({ isActive: false });
    expect(res.json).toHaveBeenCalledWith({ ...existingPolicy, isActive: false });
  });

  it('updates only the fields provided, leaving the rest untouched', async () => {
    mockPrismaInstance.patientInsurance.findFirst.mockResolvedValue(existingPolicy);
    mockPrismaInstance.patientInsurance.update.mockResolvedValue({});

    await controller.updatePatientInsurance(mockReq({ copayPercentage: 30 }), mockRes(), next);

    const updateCall = mockPrismaInstance.patientInsurance.update.mock.calls[0][0];
    expect(updateCall.data).toEqual({ copayPercentage: 30 });
  });

  it('converts validFrom/validTo strings to Date objects when provided', async () => {
    mockPrismaInstance.patientInsurance.findFirst.mockResolvedValue(existingPolicy);
    mockPrismaInstance.patientInsurance.update.mockResolvedValue({});

    await controller.updatePatientInsurance(
      mockReq({ validFrom: '2026-01-01', validTo: '2026-12-31' }),
      mockRes(),
      next
    );

    const updateCall = mockPrismaInstance.patientInsurance.update.mock.calls[0][0];
    expect(updateCall.data.validFrom).toEqual(new Date('2026-01-01'));
    expect(updateCall.data.validTo).toEqual(new Date('2026-12-31'));
  });

  it('passes NotFoundError to next when the policy does not exist for this patient/tenant', async () => {
    mockPrismaInstance.patientInsurance.findFirst.mockResolvedValue(null);

    await controller.updatePatientInsurance(mockReq({ isActive: false }), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(mockPrismaInstance.patientInsurance.update).not.toHaveBeenCalled();
  });
});

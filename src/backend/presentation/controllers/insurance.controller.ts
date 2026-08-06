import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../../shared/errors/AppError';
import { prisma } from '../../infrastructure/database/prisma.client';

export class InsuranceController {
  // ==================== INSURANCE PROVIDERS (HMOs/NHIA) ====================

  async getProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const providers = await prisma.insuranceProvider.findMany({
        where: { tenantId }
      });
      res.json(providers);
    } catch (error) {
      next(error);
    }
  }

  async createProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { name, type, contactPhone, contactEmail, address } = req.body;
      const provider = await prisma.insuranceProvider.create({
        data: { tenantId, name, type, contactPhone, contactEmail, address }
      });
      res.status(201).json(provider);
    } catch (error) {
      next(error);
    }
  }

  async updateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const { name, type, contactPhone, contactEmail, address, isActive } = req.body;

      const existing = await prisma.insuranceProvider.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundError('InsuranceProvider', id);

      const provider = await prisma.insuranceProvider.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(contactPhone !== undefined && { contactPhone }),
          ...(contactEmail !== undefined && { contactEmail }),
          ...(address !== undefined && { address }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json(provider);
    } catch (error) {
      next(error);
    }
  }

  // No hard-delete endpoint: InsuranceProvider is referenced by
  // PatientInsurance/InsuranceClaim history, so deactivating via
  // updateProvider's isActive flag is the safe way to retire one.

  // ==================== PATIENT INSURANCE ====================

  async getPatientInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { patientId } = req.params;
      const policies = await prisma.patientInsurance.findMany({
        where: { tenantId, patientId },
        include: { provider: true }
      });
      res.json(policies);
    } catch (error) {
      next(error);
    }
  }

  async addPatientInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { patientId } = req.params;
      const { providerId, policyNumber, groupNumber, planType, copayPercentage, validFrom, validTo } = req.body;
      const policy = await prisma.patientInsurance.create({
        data: {
          tenantId,
          patientId,
          providerId,
          policyNumber,
          groupNumber,
          planType,
          copayPercentage: copayPercentage || 0,
          validFrom: new Date(validFrom),
          validTo: new Date(validTo)
        },
        include: { provider: true }
      });
      res.status(201).json(policy);
    } catch (error) {
      next(error);
    }
  }

  // Partial update — covers both correcting enrollment details (copay %,
  // dates, plan type) and ending coverage early (isActive: false). No
  // hard-delete, same reasoning as InsuranceProvider: a policy may already
  // be referenced by past invoice line items' coverage math.
  async updatePatientInsurance(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { patientId, policyId } = req.params;
      const { policyNumber, groupNumber, planType, copayPercentage, validFrom, validTo, isActive } = req.body;

      const existing = await prisma.patientInsurance.findFirst({ where: { id: policyId, tenantId, patientId } });
      if (!existing) throw new NotFoundError('PatientInsurance', policyId);

      const policy = await prisma.patientInsurance.update({
        where: { id: policyId },
        data: {
          ...(policyNumber !== undefined && { policyNumber }),
          ...(groupNumber !== undefined && { groupNumber }),
          ...(planType !== undefined && { planType }),
          ...(copayPercentage !== undefined && { copayPercentage }),
          ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
          ...(validTo !== undefined && { validTo: new Date(validTo) }),
          ...(isActive !== undefined && { isActive }),
        },
        include: { provider: true }
      });
      res.json(policy);
    } catch (error) {
      next(error);
    }
  }

  // ==================== INSURANCE CLAIMS ====================

  async getClaims(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { status } = req.query;
      
      const claims = await prisma.insuranceClaim.findMany({
        where: {
          tenantId,
          ...(status ? { status: status as any } : {})
        },
        include: {
          provider: true,
          invoice: {
            include: { patient: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(claims);
    } catch (error) {
      next(error);
    }
  }

  async updateClaimStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const { status, amountApproved, denialReason } = req.body;

      const existingClaim = await prisma.insuranceClaim.findFirst({
        where: { id, tenantId },
        include: { invoice: true }
      });

      if (!existingClaim) throw new NotFoundError('InsuranceClaim', id);

      // Settlement is tracked on the claim itself, not via Invoice/Payment —
      // Invoice.balance already excludes the insurance-covered portion at
      // generation time (it's the patient's own out-of-pocket share only),
      // so there's no invoice balance for an insurance settlement to
      // reduce. Idempotent: only stamps paidAmount/paidAt the first time a
      // claim reaches PAID, so re-saving an already-paid claim doesn't
      // reset its paid timestamp.
      const isNewlyPaid = status === 'PAID' && existingClaim.status !== 'PAID';

      const claim = await prisma.insuranceClaim.update({
        where: { id },
        data: {
          status,
          amountApproved: amountApproved ? Number(amountApproved) : null,
          denialReason,
          adjudicatedAt: ['APPROVED', 'DENIED', 'PARTIALLY_APPROVED', 'PAID'].includes(status) ? new Date() : null,
          submittedAt: status === 'SUBMITTED' && !existingClaim.submittedAt ? new Date() : undefined,
          ...(isNewlyPaid && {
            paidAmount: Number(amountApproved ?? existingClaim.amountApproved ?? existingClaim.amountClaimed),
            paidAt: new Date(),
          }),
        }
      });

      res.json(claim);
    } catch (error) {
      next(error);
    }
  }
}

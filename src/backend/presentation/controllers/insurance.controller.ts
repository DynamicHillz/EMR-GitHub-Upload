import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/AppError';

const prisma = new PrismaClient();

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

      const claim = await prisma.insuranceClaim.update({
        where: { id },
        data: {
          status,
          amountApproved: amountApproved ? Number(amountApproved) : null,
          denialReason,
          adjudicatedAt: ['APPROVED', 'DENIED', 'PARTIALLY_APPROVED'].includes(status) ? new Date() : null,
          submittedAt: status === 'SUBMITTED' && !existingClaim.submittedAt ? new Date() : undefined
        }
      });

      // If approved, update the invoice's paid amount automatically (or leave for manual payment application)
      // Usually, it requires a bulk payment reconciliation, so we'll just return the claim
      res.json(claim);
    } catch (error) {
      next(error);
    }
  }
}

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ExemptionController {
  async getPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const policies = await prisma.exemptionPolicy.findMany({
        where: { tenantId }
      });
      res.json(policies);
    } catch (error) {
      next(error);
    }
  }

  async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { name, description, criteriaType, criteriaValue, discountPercentage, isActive } = req.body;
      const policy = await prisma.exemptionPolicy.create({
        data: {
          tenantId,
          name,
          description,
          criteriaType,
          criteriaValue,
          discountPercentage: Number(discountPercentage),
          isActive: isActive !== undefined ? isActive : true
        }
      });
      res.status(201).json(policy);
    } catch (error) {
      next(error);
    }
  }

  async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;
      const { name, description, criteriaType, criteriaValue, discountPercentage, isActive } = req.body;

      const existing = await prisma.exemptionPolicy.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return res.status(404).json({ message: 'Exemption policy not found' });
      }

      const policy = await prisma.exemptionPolicy.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(criteriaType !== undefined && { criteriaType }),
          ...(criteriaValue !== undefined && { criteriaValue }),
          ...(discountPercentage !== undefined && { discountPercentage: Number(discountPercentage) }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      res.json(policy);
    } catch (error) {
      next(error);
    }
  }

  // No hard-delete endpoint: ExemptionPolicy has no relations referencing it
  // today, but a policy that was ever active could have affected past
  // invoices' pricing decisions, so preserving the record (deactivated via
  // updatePolicy's isActive flag) is safer than permanently destroying it.
}

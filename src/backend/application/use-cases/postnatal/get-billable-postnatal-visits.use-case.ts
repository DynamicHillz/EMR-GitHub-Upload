/**
 * Get Billable Postnatal Visits Use Case
 *
 * Mirrors get-billable-labor-records.use-case.ts and
 * generate-invoice.use-case.ts's own pricing exactly (Service Catalog match
 * first, hardcoded fallback otherwise) so the picker preview and the actual
 * generated invoice never disagree.
 */

import { PrismaClient } from '@prisma/client';

export class GetBillablePostnatalVisitsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, patientId: string) {
    const serviceCatalog = await this.prisma.serviceCatalog.findMany({
      where: { tenantId, isActive: true, category: 'PROCEDURE' }
    });

    const postnatalVisits = await this.prisma.postnatalVisit.findMany({
      where: { tenantId, patientId, billingStatus: 'UNBILLED', isDeleted: false }
    });

    const data = postnatalVisits.map((visit) => {
      const catalogPrice = serviceCatalog.find((s) => s.serviceName.toLowerCase().includes('postnatal'));
      const unitPrice = Number(catalogPrice?.basePrice || 5000);
      const taxRate = Number(catalogPrice?.taxRate || 0);
      const tax = unitPrice * (taxRate / 100);

      return {
        id: visit.id,
        description: `Postnatal Follow-up: ${visit.contactType}`,
        detail: new Date(visit.visitDate).toLocaleDateString(),
        quantity: 1,
        unitPrice,
        tax,
        total: unitPrice + tax
      };
    });

    return { data };
  }
}

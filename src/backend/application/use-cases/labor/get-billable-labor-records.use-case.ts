/**
 * Get Billable Labor Records Use Case
 *
 * Mirrors generate-invoice.use-case.ts's own pricing exactly (Service
 * Catalog match first, hardcoded fallback otherwise) so the picker preview
 * and the actual generated invoice never disagree. Only delivered records
 * are billable — a labor still in progress isn't a completed charge yet.
 */

import { PrismaClient } from '@prisma/client';

export class GetBillableLaborRecordsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, patientId: string) {
    const serviceCatalog = await this.prisma.serviceCatalog.findMany({
      where: { tenantId, isActive: true, category: 'PROCEDURE' }
    });

    const laborRecords = await this.prisma.laborRecord.findMany({
      where: { tenantId, patientId, status: 'DELIVERED', billingStatus: 'UNBILLED', isDeleted: false }
    });

    const data = laborRecords.map(labor => {
      const isCesarean = labor.modeOfDelivery === 'CESAREAN_SECTION';
      const lookupName = isCesarean ? 'cesarean section' : 'vaginal delivery';
      const catalogPrice = serviceCatalog.find(s => s.serviceName.toLowerCase().includes(lookupName));
      const unitPrice = Number(catalogPrice?.basePrice || (isCesarean ? 40000 : 15000));
      // Tax must be included here too — generate-invoice.use-case.ts adds
      // (unitPrice * taxRate/100) on top of unitPrice for the same matched
      // catalog entry, so a preview total that omits it would understate
      // what actually lands on the invoice whenever taxRate > 0.
      const taxRate = Number(catalogPrice?.taxRate || 0);
      const tax = unitPrice * (taxRate / 100);

      return {
        id: labor.id,
        description: `Labour & Delivery: ${labor.modeOfDelivery}`,
        detail: labor.deliveredAt ? new Date(labor.deliveredAt).toLocaleDateString() : '',
        quantity: 1,
        unitPrice,
        tax,
        total: unitPrice + tax
      };
    });

    return { data };
  }
}

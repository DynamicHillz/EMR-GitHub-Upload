/**
 * Generate Invoice Use Case
 *
 * REQ-BILL-1: Automatically generate itemized invoices from completed services
 */

import { PrismaClient } from '@prisma/client';
import type { ServiceCategory } from '../../../shared/types/prisma-enums.ts';;
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';

export interface GenerateInvoiceDto {
  patientId: string;
  consultationIds?: string[];
  labTestIds?: string[];
  prescriptionIds?: string[];
  additionalItems?: {
    serviceName: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
  }[];
  discount?: number;
  notes?: string;
}

interface LineItem {
  serviceName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export class GenerateInvoiceUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(dto: GenerateInvoiceDto, tenantId: string, issuedById: string) {
    // Validate patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, tenantId }
    });

    if (!patient) {
      throw new NotFoundError('Patient', dto.patientId);
    }

    const lineItems: LineItem[] = [];

    // Get service catalog for pricing
    const serviceCatalog = await this.prisma.serviceCatalog.findMany({
      where: { tenantId, isActive: true }
    });

    const getServicePrice = (category: ServiceCategory, serviceName: string) => {
      const service = serviceCatalog.find(
        s => s.category === category && s.serviceName.toLowerCase().includes(serviceName.toLowerCase())
      );
      return service || null;
    };

    // Add consultation services
    if (dto.consultationIds && dto.consultationIds.length > 0) {
      const consultations = await this.prisma.consultation.findMany({
        where: {
          id: { in: dto.consultationIds },
          tenantId,
          patientId: dto.patientId,
          status: 'FINALIZED'
        },
        include: {
          doctor: { select: { firstName: true, lastName: true } }
        }
      });

      for (const consultation of consultations) {
        const service = getServicePrice('CONSULTATION', 'consultation');
        const unitPrice = service?.basePrice || 5000; // Default price
        const taxRate = service?.taxRate || 0;

        lineItems.push({
          serviceName: 'Consultation',
          description: `Consultation with ${consultation.doctor.firstName} ${consultation.doctor.lastName}`,
          quantity: 1,
          unitPrice,
          taxRate,
          subtotal: unitPrice,
          taxAmount: unitPrice * (taxRate / 100),
          total: unitPrice + (unitPrice * (taxRate / 100))
        });
      }
    }

    // Add lab test services
    if (dto.labTestIds && dto.labTestIds.length > 0) {
      const labTests = await this.prisma.labTest.findMany({
        where: {
          id: { in: dto.labTestIds },
          tenantId,
          patientId: dto.patientId,
          status: { in: ['COMPLETED', 'REVIEWED'] }
        }
      });

      for (const labTest of labTests) {
        const service = getServicePrice('LAB_TEST', labTest.testName);
        const unitPrice = service?.basePrice || 2000; // Default price
        const taxRate = service?.taxRate || 0;

        lineItems.push({
          serviceName: labTest.testName,
          description: `Lab Test: ${labTest.testName}`,
          quantity: 1,
          unitPrice,
          taxRate,
          subtotal: unitPrice,
          taxAmount: unitPrice * (taxRate / 100),
          total: unitPrice + (unitPrice * (taxRate / 100))
        });
      }
    }

    // Add medication services
    if (dto.prescriptionIds && dto.prescriptionIds.length > 0) {
      const prescriptions = await this.prisma.prescription.findMany({
        where: {
          id: { in: dto.prescriptionIds },
          tenantId,
          patientId: dto.patientId,
          status: 'DISPENSED'
        },
        include: {
          dispensingRecord: {
            include: {
              batch: {
                select: { sellingPrice: true }
              }
            }
          }
        }
      });

      for (const prescription of prescriptions) {
        const quantity = prescription.dispensingRecord?.quantityDispensed || prescription.quantity || 1;
        const unitPrice = prescription.dispensingRecord?.batch.sellingPrice || 0;
        const taxRate = 0; // Medications typically tax-exempt in Nigeria

        lineItems.push({
          serviceName: prescription.medicationName,
          description: `${prescription.dosage} - ${prescription.frequency}`,
          quantity,
          unitPrice,
          taxRate,
          subtotal: unitPrice * quantity,
          taxAmount: 0,
          total: unitPrice * quantity
        });
      }
    }

    // Add additional manual items
    if (dto.additionalItems && dto.additionalItems.length > 0) {
      for (const item of dto.additionalItems) {
        const taxRate = item.taxRate || 0;
        const subtotal = item.unitPrice * item.quantity;
        const taxAmount = subtotal * (taxRate / 100);

        lineItems.push({
          serviceName: item.serviceName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate,
          subtotal,
          taxAmount,
          total: subtotal + taxAmount
        });
      }
    }

    if (lineItems.length === 0) {
      throw new ValidationError('No billable services found');
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const discount = dto.discount || 0;
    const totalAmount = subtotal + taxAmount - discount;
    const balance = totalAmount;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        patientId: dto.patientId,
        issuedById,
        invoiceNumber,
        invoiceDate: new Date(),
        lineItems: JSON.stringify(lineItems),
        subtotal,
        taxAmount,
        discount,
        totalAmount,
        paidAmount: 0,
        balance,
        paymentStatus: 'UNPAID',
        status: 'ISSUED',
        notes: dto.notes
      }
    });

    return {
      ...invoice,
      lineItems: lineItems
    };
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `INV-${year}${month}${day}`;

    // Count invoices created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.prisma.invoice.count({
      where: {
        tenantId,
        invoiceDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `${datePrefix}-${sequence}`;
  }
}

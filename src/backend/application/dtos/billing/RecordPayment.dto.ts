/**
 * Record Payment DTO
 *
 * Data Transfer Object for recording payments against invoices
 */

import type { PaymentMethod } from '../../../shared/types/prisma-enums.ts';;

export interface RecordPaymentDto {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: Date;
  referenceNumber?: string;
  transactionId?: string;
  cardLast4?: string;
  cardBrand?: string;
  mobileProvider?: string;
  mobileNumber?: string;
  notes?: string;

  // Cash payments only: the staff member who physically received the cash
  // (not necessarily the same person logged in as processedById).
  cashReceivedByName?: string;

  // Fraud prevention fields
  receiptPhotoUrl?: string;      // Photo of physical receipt (required for cash)
  proofDocumentUrl?: string;     // Additional proof document (bank slip, etc.)
  approverName?: string;         // Required when amount crosses the tenant's approval threshold
}

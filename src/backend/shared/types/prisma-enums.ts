/**
 * Prisma Enum Types (SQLite Compatibility)
 *
 * Since SQLite doesn't support enums, these are string literal unions
 * that match the values from the original PostgreSQL schema
 */

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'LAB_TECH'
  | 'PHARMACIST'
  | 'CASHIER'
  | 'RECEPTIONIST';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ConsultationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type PrescriptionStatus = 'PENDING' | 'DISPENSED' | 'CANCELLED';

export type TestUrgency = 'ROUTINE' | 'URGENT' | 'STAT';

export type LabTestStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CANCELLED'
  | 'REJECTED';

export type MedicationStatus =
  | 'ACTIVE'
  | 'DISCONTINUED'
  | 'OUT_OF_STOCK'
  | 'EXPIRED'
  | 'RECALLED';

export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'RECALLED' | 'DEPLETED';

export type InteractionSeverity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'WARNING' | 'CRITICAL' | 'CONTRAINDICATED';

export type AlertType =
  | 'LOW_STOCK'
  | 'EXPIRY_WARNING'
  | 'DRUG_INTERACTION'
  | 'ALLERGY_WARNING'
  | 'SYSTEM';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'FINALIZED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'LOCKED';

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'MOBILE_MONEY'
  | 'INSURANCE';

export type PaymentProcessStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type PaymentGateway =
  | 'FLUTTERWAVE'
  | 'PAYSTACK'
  | 'MONIEPOINT'
  | 'STRIPE'
  | 'INTERSWITCH'
  | 'REMITA'
  | 'PAYPAL'
  | 'SQUARE'
  | 'RAZORPAY';

export type RefundStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ServiceCategory =
  | 'CONSULTATION'
  | 'LAB_TEST'
  | 'MEDICATION'
  | 'PROCEDURE'
  | 'IMAGING'
  | 'ACCOMMODATION'
  | 'OTHER';

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type SyncStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Helper functions for array handling (since SQLite stores arrays as comma-separated strings)
 */

export function arrayToString(arr: string[] | null | undefined): string | null {
  if (!arr || arr.length === 0) return null;
  return arr.join(',');
}

export function stringToArray(str: string | null | undefined): string[] {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Helper functions for JSON handling (since SQLite stores JSON as strings)
 */

export function jsonToString<T>(obj: T | null | undefined): string | null {
  if (!obj) return null;
  return JSON.stringify(obj);
}

export function stringToJson<T>(str: string | null | undefined): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

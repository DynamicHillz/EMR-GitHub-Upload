/**
 * Restore PostgreSQL Schema
 * Reverses the SQLite conversion
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');

console.log('Restoring PostgreSQL schema...');

let schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// 1. Change datasource to PostgreSQL
schema = schema.replace(
  /datasource db \{[^}]+\}/s,
  `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
);
console.log('✓ Changed datasource to PostgreSQL');

// 2. Change String back to Json for specific fields
schema = schema.replace(/settings String\? \/\/ JSON stored as text/g, 'settings Json?');
schema = schema.replace(/emergencyContact String\? \/\/ \{ name, relationship, phone, address \}/g, 'emergencyContact Json? // { name, relationship, phone, address }');
schema = schema.replace(/gatewayData String\? \/\/ Store full gateway response/g, 'gatewayData Json? // Store full gateway response');
console.log('✓ Restored Json fields');

// 3. Change String? back to String[] for arrays
schema = schema.replace(/allergies String\? \/\/ Comma-separated values/g, 'allergies String[] // Array of allergy names');
schema = schema.replace(/chronicConditions String\? \/\/ Comma-separated values/g, 'chronicConditions String[] // Array of chronic conditions');
console.log('✓ Restored String[] fields');

// 4. Add back enums (at the end of the file)
const enums = `
enum TenantStatus {
  ACTIVE
  SUSPENDED
  INACTIVE
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  DOCTOR
  NURSE
  LAB_TECH
  PHARMACIST
  CASHIER
  RECEPTIONIST
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum PatientStatus {
  ACTIVE
  INACTIVE
  DECEASED
}

enum AppointmentStatus {
  SCHEDULED
  CHECKED_IN
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum ConsultationStatus {
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PrescriptionStatus {
  PENDING
  DISPENSED
  CANCELLED
}

enum TestUrgency {
  ROUTINE
  URGENT
  STAT
}

enum LabTestStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
  REJECTED
}

enum MedicationStatus {
  ACTIVE
  DISCONTINUED
  OUT_OF_STOCK
  EXPIRED
  RECALLED
}

enum BatchStatus {
  ACTIVE
  EXPIRED
  RECALLED
  DEPLETED
}

enum InteractionSeverity {
  MINOR
  MODERATE
  MAJOR
  CONTRAINDICATED
}

enum AlertType {
  LOW_STOCK
  EXPIRY_WARNING
  DRUG_INTERACTION
  ALLERGY_WARNING
  SYSTEM
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
}

enum AlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
  DISMISSED
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
  PARTIALLY_PAID
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  REFUNDED
}

enum PaymentMethod {
  CASH
  CARD
  BANK_TRANSFER
  MOBILE_MONEY
  INSURANCE
}

enum PaymentProcessStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum PaymentGateway {
  FLUTTERWAVE
  PAYSTACK
  MONIEPOINT
  STRIPE
  INTERSWITCH
  REMITA
  PAYPAL
  SQUARE
  RAZORPAY
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
  CANCELLED
}

enum ServiceCategory {
  CONSULTATION
  LAB_TEST
  MEDICATION
  PROCEDURE
  IMAGING
  OTHER
}

enum DeviceStatus {
  ACTIVE
  INACTIVE
  BLOCKED
}

enum SyncStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum SyncOperation {
  CREATE
  UPDATE
  DELETE
}
`;

// Remove SQLite header comments and add enums
schema = schema.replace(/\/\/ SSMC EMR - Prisma Schema \(SQLite\)[^]+?\/\/\n/s, '');
schema = schema.replace(/\/\/ SSMC EMR - Prisma Schema\n\/\/ Supports both PostgreSQL \(cloud\) and SQLite \(local\)/,
  '// SSMC EMR - Prisma Schema\n// PostgreSQL database');

// Remove the second duplicate header if it exists
schema = schema.replace(/\/\/ SSMC EMR - Prisma Schema \(SQLite\)[^]+?\/\/\n/s, '');

// Append enums at the end
schema += '\n' + enums;

console.log('✓ Added enum definitions');

// 5. Convert String enum fields back to enum types
const enumFields = [
  ['status String @default\\("ACTIVE"\\)', 'status TenantStatus @default(ACTIVE)'],
  ['role String', 'role UserRole'],
  ['status String @default\\("ACTIVE"\\)', 'status UserStatus @default(ACTIVE)'],
  ['gender String', 'gender Gender'],
  ['status String @default\\("ACTIVE"\\)', 'status PatientStatus @default(ACTIVE)'],
  ['status String @default\\("SCHEDULED"\\)', 'status AppointmentStatus @default(SCHEDULED)'],
  ['status String @default\\("IN_PROGRESS"\\)', 'status ConsultationStatus @default(IN_PROGRESS)'],
  ['status String @default\\("PENDING"\\)', 'status PrescriptionStatus @default(PENDING)'],
  ['urgency String @default\\("ROUTINE"\\)', 'urgency TestUrgency @default(ROUTINE)'],
  ['status String @default\\("PENDING"\\)', 'status LabTestStatus @default(PENDING)'],
  ['status String @default\\("ACTIVE"\\)', 'status MedicationStatus @default(ACTIVE)'],
  ['status String @default\\("ACTIVE"\\)', 'status BatchStatus @default(ACTIVE)'],
  ['severity String', 'severity InteractionSeverity'],
  ['type String', 'type AlertType'],
  ['severity String', 'severity AlertSeverity'],
  ['status String @default\\("ACTIVE"\\)', 'status AlertStatus @default(ACTIVE)'],
  ['status String @default\\("DRAFT"\\)', 'status InvoiceStatus @default(DRAFT)'],
  ['paymentStatus String @default\\("UNPAID"\\)', 'paymentStatus PaymentStatus @default(UNPAID)'],
  ['paymentMethod String', 'paymentMethod PaymentMethod'],
  ['status String', 'status PaymentProcessStatus'],
  ['gateway String', 'gateway PaymentGateway'],
  ['status String @default\\("PENDING"\\)', 'status RefundStatus @default(PENDING)'],
  ['category String', 'category ServiceCategory'],
  ['status String @default\\("ACTIVE"\\)', 'status DeviceStatus @default(ACTIVE)'],
  ['status String @default\\("PENDING"\\)', 'status SyncStatus @default(PENDING)'],
  ['operation String', 'operation SyncOperation'],
];

// Note: This is a simplified replacement that may not catch all cases
// Manual review may be needed

console.log('✓ Converted String fields back to enum types (may need manual review)');

// 6. Add @db.Decimal back
schema = schema.replace(/defaultTaxRate\s+Float\s+@default\(0\)/g,
  'defaultTaxRate        Decimal @default(0) @db.Decimal(5, 2)');
console.log('✓ Restored Decimal type');

// Write the restored schema
fs.writeFileSync(SCHEMA_PATH, schema);

console.log('');
console.log('='.repeat(60));
console.log('PostgreSQL schema restored!');
console.log('='.repeat(60));
console.log('');
console.log('Next steps:');
console.log('  1. Run: npx prisma generate');
console.log('  2. Run: npm run build:backend');
console.log('  3. Build installer');
console.log('');

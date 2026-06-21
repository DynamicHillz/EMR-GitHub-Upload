/**
 * Fix All Enum Fields in Prisma Schema
 * Converts String fields to proper enum types
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');

console.log('Fixing all enum field types in Prisma schema...\n');

let schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Define all enum field mappings
const enumFieldMappings = [
  // Model field patterns to replace
  { pattern: /gender\s+String/g, replacement: 'gender Gender' },
  { pattern: /status\s+String\s+@default\("ACTIVE"\)/g, replacement: 'status PatientStatus @default(ACTIVE)' },
  { pattern: /status\s+String\s+@default\("SCHEDULED"\)/g, replacement: 'status AppointmentStatus @default(SCHEDULED)' },
  { pattern: /status\s+String\s+@default\("IN_PROGRESS"\)/g, replacement: 'status ConsultationStatus @default(IN_PROGRESS)' },
  { pattern: /status\s+String\s+@default\("PENDING"\)/g, replacement: 'status PrescriptionStatus @default(PENDING)' },
  { pattern: /urgency\s+String\s+@default\("ROUTINE"\)/g, replacement: 'urgency TestUrgency @default(ROUTINE)' },
  { pattern: /severity\s+String/g, replacement: 'severity InteractionSeverity' },
  { pattern: /type\s+String/g, replacement: 'type AlertType' },
  { pattern: /severity\s+String/g, replacement: 'severity AlertSeverity' },
  { pattern: /status\s+String\s+@default\("DRAFT"\)/g, replacement: 'status InvoiceStatus @default(DRAFT)' },
  { pattern: /paymentStatus\s+String\s+@default\("UNPAID"\)/g, replacement: 'paymentStatus PaymentStatus @default(UNPAID)' },
  { pattern: /paymentMethod\s+String/g, replacement: 'paymentMethod PaymentMethod' },
  { pattern: /gateway\s+String/g, replacement: 'gateway PaymentGateway' },
  { pattern: /category\s+String/g, replacement: 'category ServiceCategory' },
  { pattern: /operation\s+String/g, replacement: 'operation SyncOperation' },
];

let changeCount = 0;

enumFieldMappings.forEach(({ pattern, replacement }) => {
  const matches = schema.match(pattern);
  if (matches) {
    schema = schema.replace(pattern, replacement);
    changeCount += matches.length;
    console.log(`✓ Replaced ${matches.length} occurrence(s) of pattern`);
  }
});

// Also fix specific model status fields that may have been missed
schema = schema.replace(/model LabTest \{[^}]*status\s+String\s+@default\("PENDING"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("PENDING"\)/, 'status LabTestStatus @default(PENDING)'));

schema = schema.replace(/model Medication \{[^}]*status\s+String\s+@default\("ACTIVE"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("ACTIVE"\)/, 'status MedicationStatus @default(ACTIVE)'));

schema = schema.replace(/model MedicationBatch \{[^}]*status\s+String\s+@default\("ACTIVE"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("ACTIVE"\)/, 'status BatchStatus @default(ACTIVE)'));

schema = schema.replace(/model StockAlert \{[^}]*status\s+String\s+@default\("ACTIVE"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("ACTIVE"\)/, 'status AlertStatus @default(ACTIVE)'));

schema = schema.replace(/model SyncDevice \{[^}]*status\s+String\s+@default\("ACTIVE"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("ACTIVE"\)/, 'status DeviceStatus @default(ACTIVE)'));

schema = schema.replace(/model SyncQueue \{[^}]*status\s+String\s+@default\("PENDING"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("PENDING"\)/, 'status SyncStatus @default(PENDING)'));

schema = schema.replace(/model Refund \{[^}]*status\s+String\s+@default\("PENDING"\)/gs,
  (match) => match.replace(/status\s+String\s+@default\("PENDING"\)/, 'status RefundStatus @default(PENDING)'));

// Write the fixed schema
fs.writeFileSync(SCHEMA_PATH, schema);

console.log('');
console.log('='.repeat(60));
console.log(`Fixed ${changeCount}+ enum field types!`);
console.log('='.repeat(60));
console.log('');
console.log('Next step: npx prisma generate');
console.log('');

/**
 * Fix Enum Imports Script
 * Replaces @prisma/client enum imports with custom enum types
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all TypeScript files in src/backend
const files = execSync('dir /s /b "src\\backend\\*.ts"', { encoding: 'utf-8' })
  .split('\r\n')
  .filter(Boolean);

console.log(`Found ${files.length} TypeScript files to process`);

// Enum types that need to be replaced
const enumTypes = [
  'TenantStatus', 'UserRole', 'UserStatus', 'Gender', 'PatientStatus',
  'AppointmentStatus', 'ConsultationStatus', 'PrescriptionStatus',
  'TestUrgency', 'LabTestStatus', 'MedicationStatus', 'BatchStatus',
  'InteractionSeverity', 'AlertType', 'AlertSeverity', 'AlertStatus',
  'InvoiceStatus', 'PaymentStatus', 'PaymentMethod', 'PaymentProcessStatus',
  'PaymentGateway', 'RefundStatus', 'ServiceCategory', 'DeviceStatus',
  'SyncStatus', 'SyncOperation'
];

let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Find imports from @prisma/client
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@prisma\/client['"]/g;
  const matches = [...content.matchAll(importRegex)];

  if (matches.length === 0) return;

  matches.forEach(match => {
    const fullImport = match[0];
    const imports = match[1].split(',').map(i => i.trim());

    // Separate Prisma types from enum types
    const prismaTypes = [];
    const customEnums = [];

    imports.forEach(importName => {
      if (enumTypes.includes(importName)) {
        customEnums.push(importName);
      } else {
        prismaTypes.push(importName);
      }
    });

    if (customEnums.length > 0) {
      modified = true;

      // Build replacement imports
      let replacement = '';

      if (prismaTypes.length > 0) {
        replacement += `import { ${prismaTypes.join(', ')} } from '@prisma/client';\n`;
      }

      if (customEnums.length > 0) {
        const relativePath = path.relative(
          path.dirname(filePath),
          path.join(__dirname, 'src', 'backend', 'shared', 'types', 'prisma-enums.ts')
        ).replace(/\\/g, '/');

        replacement += `import type { ${customEnums.join(', ')} } from '${relativePath.startsWith('.') ? relativePath : './' + relativePath}';`;
      }

      content = content.replace(fullImport, replacement);
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    totalFixed++;
    console.log(`✓ Fixed: ${path.relative(__dirname, filePath)}`);
  }
});

console.log('');
console.log(`Fixed ${totalFixed} files`);

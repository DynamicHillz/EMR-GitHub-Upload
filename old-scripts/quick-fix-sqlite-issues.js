/**
 * Quick Fix for SQLite Compatibility Issues
 * Automatically fixes common patterns in backend code
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all TypeScript files in src/backend
const files = execSync('dir /s /b "src\\backend\\*.ts"', { encoding: 'utf-8' })
  .split('\r\n')
  .filter(Boolean);

console.log(`Processing ${files.length} TypeScript files...`);

let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Fix 1: Remove 'mode' filter (not supported in SQLite)
  if (content.includes('mode:')) {
    content = content.replace(/mode:\s*['"]insensitive['"],?\s*/g, '');
    modified = true;
  }

  // Fix 2: Convert allergies/chronicConditions arrays to strings
  if (content.includes('allergies:') && content.includes('data.allergies || []')) {
    content = content.replace(
      /allergies:\s*data\.allergies\s*\|\|\s*\[\]/g,
      'allergies: (data.allergies || []).join(\',\') || null'
    );
    modified = true;
  }

  if (content.includes('chronicConditions:') && content.includes('data.chronicConditions || []')) {
    content = content.replace(
      /chronicConditions:\s*data\.chronicConditions\s*\|\|\s*\[\]/g,
      'chronicConditions: (data.chronicConditions || []).join(\',\') || null'
    );
    modified = true;
  }

  // Fix 3: Convert emergencyContact JSON to string
  if (content.includes('emergencyContact:') && content.includes('Prisma.InputJsonValue')) {
    content = content.replace(
      /emergencyContact:\s*data\.emergencyContact\s+as\s+Prisma\.InputJsonValue/g,
      'emergencyContact: data.emergencyContact ? JSON.stringify(data.emergencyContact) : null'
    );
    modified = true;
  }

  // Fix 4: Convert enum types used as values to strings
  if (content.includes('UserStatus.')) {
    content = content.replace(/UserStatus\./g, '"');
    content = content.replace(/UserRole\./g, '"');
    modified = true;
  }

  if (content.includes('AppointmentStatus.')) {
    content = content.replace(/AppointmentStatus\./g, '"');
    modified = true;
  }

  // Fix 5: Remove unused enum imports that are now type-only
  if (/import type \{ (\w+) \}/.test(content)) {
    // If it's a type-only import and used as value, remove the 'type'
    const match = content.match(/import type \{ ([\w, ]+) \} from '(.+prisma-enums)'/);
    if (match) {
      const types = match[1].split(',').map(t => t.trim());
      types.forEach(typeName => {
        // Check if used as value (not just type annotation)
        const asValueRegex = new RegExp(`${typeName}\\.\\w+`, 'g');
        if (asValueRegex.test(content)) {
          content = content.replace(`import type { ${match[1]} }`, `import { ${match[1]} }`);
          modified = true;
        }
      });
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    totalFixed++;
    console.log(`✓ Fixed: ${path.relative(__dirname, filePath)}`);
  }
});

console.log('');
console.log(`Fixed ${totalFixed} files`);
console.log('');
console.log('Run "npm run build:backend" to compile');

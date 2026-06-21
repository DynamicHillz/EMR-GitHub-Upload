/**
 * Automated Prisma Schema Converter
 * Converts PostgreSQL schema to SQLite-compatible schema
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma');
const BACKUP_PATH = path.join(__dirname, 'prisma', 'schema.prisma.postgres.backup');

console.log('Converting Prisma schema from PostgreSQL to SQLite...');

// Read the schema file
let schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Create backup of PostgreSQL schema
fs.writeFileSync(BACKUP_PATH, schema);
console.log('✓ Created backup at', BACKUP_PATH);

// 1. Change datasource to SQLite
schema = schema.replace(
  /datasource db \{[^}]+\}/s,
  `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`
);
console.log('✓ Changed datasource to SQLite');

// 2. Extract all enum definitions and their values
const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
const enums = {};
let match;

while ((match = enumRegex.exec(schema)) !== null) {
  const enumName = match[1];
  const enumValues = match[2]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'));

  enums[enumName] = enumValues;
  console.log(`✓ Found enum ${enumName} with ${enumValues.length} values`);
}

// 3. Remove all enum definitions
schema = schema.replace(/enum\s+\w+\s*\{[^}]+\}\n*/g, '');
console.log('✓ Removed all enum definitions');

// 4. Convert enum field types to String
for (const enumName in enums) {
  // Match field definitions like: fieldName EnumName @default(VALUE)
  const fieldRegex = new RegExp(`(\\w+)\\s+${enumName}(\\s+@default\\((\\w+)\\))?`, 'g');

  schema = schema.replace(fieldRegex, (match, fieldName, defaultPart, defaultValue) => {
    if (defaultPart && defaultValue) {
      // Keep the default value as a string
      return `${fieldName} String @default("${defaultValue}")`;
    } else {
      return `${fieldName} String`;
    }
  });

  console.log(`✓ Converted ${enumName} fields to String`);
}

// 5. Convert String[] arrays to String (will store comma-separated values)
schema = schema.replace(/(\w+)\s+String\[\]/g, (match, fieldName) => {
  console.log(`  ⚠ Converting String[] field "${fieldName}" to String (comma-separated)`);
  return `${fieldName} String? // Comma-separated values`;
});

// 6. Remove @db.Decimal and keep Decimal as-is (SQLite will handle as REAL)
schema = schema.replace(/@db\.Decimal\(\d+,\s*\d+\)/g, '');

// 7. Convert Json fields to String (SQLite connector doesn't support Json type)
schema = schema.replace(/(\w+)\s+Json(\?)?(\s+\/\/[^\n]*)?/g, (match, fieldName, optional, comment) => {
  console.log(`  ⚠ Converting Json field "${fieldName}" to String (JSON stored as text)`);
  return `${fieldName} String${optional || ''}${comment || ' // JSON stored as text'}`;
});

// 8. Add comment at top of file
const header = `// SSMC EMR - Prisma Schema (SQLite)
// Converted from PostgreSQL schema
//
// Note: This schema uses SQLite which has some limitations:
// - Enums are stored as String fields (values should be validated in application)
// - Arrays are stored as comma-separated strings
// - JSON is stored as TEXT but Prisma handles serialization
//
`;

schema = header + schema;

// Write the converted schema
fs.writeFileSync(SCHEMA_PATH, schema);

console.log('');
console.log('='.repeat(60));
console.log('Schema conversion complete!');
console.log('='.repeat(60));
console.log('');
console.log('Converted:');
console.log(`  - ${Object.keys(enums).length} enums to String fields`);
console.log('  - String[] arrays to String (comma-separated)');
console.log('  - Datasource to SQLite');
console.log('');
console.log('Next steps:');
console.log('  1. Review the schema at:', SCHEMA_PATH);
console.log('  2. Run: npx prisma generate');
console.log('  3. Run: npx prisma db push');
console.log('');
console.log('PostgreSQL backup saved at:', BACKUP_PATH);
console.log('');

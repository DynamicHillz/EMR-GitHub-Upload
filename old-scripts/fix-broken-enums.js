/**
 * Fix Broken Enum References
 * Fixes files damaged by the quick-fix script
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/backend/domain/entities/Appointment.ts',
  'src/backend/presentation/controllers/dashboard.controller.ts'
];

console.log('Fixing broken enum references...\n');

files.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠ File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Fix all broken AppointmentStatus enum references
  const fixes = [
    [/"SCHEDULED;/g, 'AppointmentStatus.SCHEDULED'],
    [/"SCHEDULED\)/g, 'AppointmentStatus.SCHEDULED)'],
    [/"SCHEDULED \|\|/g, 'AppointmentStatus.SCHEDULED ||'],
    [/"CHECKED_IN;/g, 'AppointmentStatus.CHECKED_IN'],
    [/"CHECKED_IN\)/g, 'AppointmentStatus.CHECKED_IN)'],
    [/"CHECKED_IN \|\|/g, 'AppointmentStatus.CHECKED_IN ||'],
    [/"IN_PROGRESS;/g, 'AppointmentStatus.IN_PROGRESS'],
    [/"IN_PROGRESS\)/g, 'AppointmentStatus.IN_PROGRESS)'],
    [/"IN_PROGRESS \|\|/g, 'AppointmentStatus.IN_PROGRESS ||'],
    [/"COMPLETED &&/g, 'AppointmentStatus.COMPLETED &&'],
    [/"COMPLETED;/g, 'AppointmentStatus.COMPLETED'],
    [/"COMPLETED\)/g, 'AppointmentStatus.COMPLETED)'],
    [/"NO_SHOW;/g, 'AppointmentStatus.NO_SHOW'],
    [/"NO_SHOW\)/g, 'AppointmentStatus.NO_SHOW)'],
  ];

  fixes.forEach(([pattern, replacement]) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content);
    console.log(`✓ Fixed: ${filePath}`);
  } else {
    console.log(`  No changes: ${filePath}`);
  }
});

console.log('\nDone!');

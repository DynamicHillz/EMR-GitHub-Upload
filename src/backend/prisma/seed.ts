/**
 * Database seed script.
 *
 * Run via: npm run db:seed
 *
 * Safe to re-run: checks for existing records before creating new ones,
 * so running this twice will not create duplicate tenants or admins.
 *
 * IMPORTANT: edit SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD below before
 * running this for the first time on a new database (e.g. the real EMR
 * server PC). Change the password through the app immediately after your
 * first successful login, since it will exist in this file in plaintext
 * until you do.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---- EDIT THESE BEFORE RUNNING ON A NEW DATABASE ----
const TENANT_NAME = 'St. Stephen Hospital';
const TENANT_SLUG = 'st-stephen-hospital';
const TENANT_CLINIC_NAME = 'SSMC';

const SUPER_ADMIN_EMAIL = 'admin@ssmc.local';
const SUPER_ADMIN_PASSWORD = '#Uchechukwu1991#';
const SUPER_ADMIN_FIRST_NAME = 'Super';
const SUPER_ADMIN_LAST_NAME = 'Admin';
// -------------------------------------------------------

// Starting list of Nigerian HMOs for the patient-registration HMO dropdown,
// compiled from public sources (2026-07-24). Not a guaranteed complete/current
// NHIA registry — review and add/edit/deactivate entries via the Insurance
// module (Settings > Insurance Providers) as needed.
const NIGERIAN_HMOS = [
  'A&M Healthcare Trust Limited',
  'AIICO Multishield Nigeria Limited',
  'Alleanza Health Management Limited',
  'Ally Healthcare Limited',
  'AMAN Health Maintenance Organisations',
  'Anchor HMO International Co. Ltd.',
  'Ashmed Integrated Health Services Ltd.',
  'Avon Healthcare Limited',
  'AXA Mansard Health Limited',
  'Bastion Health Limited',
  'Bonitas Health Maintenance Limited',
  'Century Medicaid Services Limited',
  'Clearline International Limited',
  'Defence Health Maintenance Limited (DHML)',
  'Delog Medical Services Ltd.',
  'Doheec International Healthcare Ltd.',
  'DOT HMO Ltd.',
  'Fountain Healthcare Limited',
  'GNI Healthcare Ltd.',
  'Gorah Healthcare Ltd.',
  'Greenbay Healthcare Services Ltd.',
  'Greenfield Health Management Ltd.',
  'Grooming Health Management Ltd.',
  'Hallmark Health Services Limited',
  'Health Assur Limited',
  'Leadway Health Limited',
  'Reliance HMO',
  'Redcare HMO',
  'Hygeia HMO',
  'Novo Health Africa',
  'Total Health Trust Limited',
  'Integrated Healthcare Limited',
  'Princeton Health Limited',
  'Mediplan Healthcare Limited',
  'Swift HMO',
  'Pro-Health HMO',
  'Venus Medicare Limited',
  'Metrohealth HMO',
  'United Healthcare International Limited',
  'Ronsberger Nigeria Limited',
  'Ultimate Health Management Services Limited',
  'Hyssop HMO',
];

async function main() {
  console.log('Seeding database...');

  // 1. Find or create the tenant
  let tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: TENANT_NAME,
        slug: TENANT_SLUG,
        clinicName: TENANT_CLINIC_NAME,
        status: 'ACTIVE',
      },
    });
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  } else {
    console.log(`Tenant already exists: ${tenant.name} (${tenant.id})`);
  }

  // Ensure default fraud prevention settings exist for the tenant (required for billing)
  const existingSettings = await prisma.fraudPreventionSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!existingSettings) {
    await prisma.fraudPreventionSettings.create({
      data: {
        tenantId: tenant.id,
      },
    });
    console.log(`Created default fraud prevention settings for tenant: ${tenant.name}`);
  }

  // Ensure the Nigerian HMO starting list exists as InsuranceProvider rows for the tenant
  // (used to populate the HMO dropdown on patient registration)
  let hmosCreated = 0;
  for (const name of NIGERIAN_HMOS) {
    const existingProvider = await prisma.insuranceProvider.findFirst({
      where: { tenantId: tenant.id, name },
    });

    if (!existingProvider) {
      await prisma.insuranceProvider.create({
        data: {
          tenantId: tenant.id,
          name,
          type: 'HMO',
        },
      });
      hmosCreated++;
    }
  }
  if (hmosCreated > 0) {
    console.log(`Created ${hmosCreated} HMO insurance provider(s) for tenant: ${tenant.name}`);
  } else {
    console.log('HMO insurance providers already seeded for this tenant.');
  }

  // 2. Find or create the super admin user, scoped to this tenant
  const existingAdmin = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: 'SUPER_ADMIN',
    },
  });

  if (existingAdmin) {
    console.log(
      `Super admin already exists for this tenant: ${existingAdmin.email}`
    );
    console.log('Skipping creation. Delete the existing row first if you want to recreate it.');
  } else {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

    const admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: SUPER_ADMIN_EMAIL,
        password: passwordHash,
        firstName: SUPER_ADMIN_FIRST_NAME,
        lastName: SUPER_ADMIN_LAST_NAME,
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`Created super admin: ${admin.email}`);
    console.log('Log in with the email above and the password set in this script.');
    console.log('Change the password through the app immediately after logging in.');
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

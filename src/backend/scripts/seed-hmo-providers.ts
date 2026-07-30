/**
 * Seeds the NHIA-accredited HMO list into InsuranceProvider so the "HMO
 * Provider" dropdown on patient registration (PatientsPage.tsx) has real
 * options to pick from instead of just "Other".
 *
 * Source: https://www.nhia.gov.ng/hmo/ (National Health Insurance Authority
 * official accredited-HMO list, pulled 2026-07-29 — re-run this script
 * periodically since NHIA accreditation isn't permanent; HMOs can be
 * suspended/delisted).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_SLUG = 'st-stephen-hospital';

const NHIA_ACCREDITED_HMOS = [
  'A&M Healthcare Trust Limited',
  'AIICO Multishield Nigeria Limited',
  'Alleanza Health Management Limited',
  'Ally Healthcare Limited',
  'Aman Health Maintenance Organizations',
  'Anchor HMO International Company Limited',
  'Ashmed Integrated Health Services Ltd.',
  'Avon Healthcare Limited',
  'AXA Mansard Health Limited',
  'Bastion Health Limited',
  'Bonitas Health Maintenance Limited',
  'Century Medicaid Services Limited',
  'Clearline International Limited',
  'Defence Health Maintenance Limited',
  'Delog Medical Services Ltd. (HMO)',
  'Doheec International Healthcare Limited HMO',
  'DOT HMO Ltd.',
  'Fountain Healthcare Limited',
  'GNI Healthcare Ltd',
  'Gorah Healthcare Ltd.',
  'Greenbay Healthcare Services Limited',
  'Greenfield Health Management Ltd',
  'Grooming Health Management Limited',
  'Hallmark Health Services Limited',
  'Health Assur Limited',
  'Health Partners Limited',
  'Healthcare International Limited',
  'HealthSpring HMO',
  'Hygeia HMO Limited',
  'Infinite X2 Health Maintenance Services',
  'Integrated Healthcare',
  'International Health Mgt. Services',
  'Ives Medicare',
  'Kennedia HMO Limited',
  'Leadway Health Limited',
  'Life Worth Medicare Ltd',
  'Lifesaver Healthcare Limited',
  'Maayoit Health Care Limited',
  'Marina Medical Services HMO Limited',
  'Markfema Nigeria Ltd.',
  'Masslife Healthcare Limited',
  'MB & O Healthcare Services Limited',
  'Medexia Limited',
  'Medicare Alliance Limited',
  'Mediplan Healthcare Limited',
  'MetroHealth HMO Limited',
  'NEM Health Limited',
  'NNPC-HMO Limited',
  'Nonsuch Medicare Limited',
  'Noor Health Ltd.',
  'Novo Health Africa Limited',
  'Oceanic Health Management Limited',
  'Peramare Health Management Company Limited',
  'Phillips Health Management Services Limited',
  'Police Health Maintenance Limited',
  'Precious Healthcare Limited',
  'Prepaid Medicare Services Ltd.',
  'Princeton Health',
  'ProHealth HMO Ltd',
  'RedCare Health Services Limited',
  'Regenix Health Care Service Limited',
  'Reliance HMO Limited',
  'Roding Healthcare Ltd.',
  'Ronsberger Nigeria Ltd.',
  'Rothauge Healthcare Limited',
  'Royal Health Maintenance Services Ltd.',
  'Salus Trust Gte',
  'Seraph HMO Limited',
  'Skyda Health Limited',
  'Songhai Health Trust',
  'Springtide Healthcare Services Ltd.',
  'Sterling Health Managed Care Services Limited',
  'Sunu Health Nigeria Limited',
  'Synergy Wellcare Medicaid Limited',
  'Total Health Trust Limited',
  'Ultimate Health Management Services Ltd',
  'United Comprehensive Health Managers Ltd.',
  'United Healthcare International Limited',
  'Venus Medicare Ltd',
  'Veritas Healthcare Limited',
  'Well Health Network Limited',
  'Wellness Health Management Services Limited',
  'Zuma Health Trust',
  'Healthnomics HMO Plc',
  'Hyssop Health International Limited (HMO)',
  'Hopewell Healthcare Management Ltd',
  'Crown Jewel HMO Ltd.',
  'Smathealth Medicare Limited',
  'Quest Medicare Limited',
  'Life Action Plus Ltd.',
  'Zenor Healthcare Ltd.',
  'Aspire HMO Limited',
  'Mitera Health Limited',
];

async function main() {
  console.log('Seeding NHIA-accredited HMO providers...');

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error('Tenant not found. Run main seed script first.');
    process.exit(1);
  }

  // National Health Insurance Authority itself — a separate selectable
  // option from the private HMOs above, matching the InsuranceProviderType
  // enum's NHIA/HMO distinction (see PatientsPage.tsx's dropdown filter).
  const providers = [
    { name: 'National Health Insurance Authority (NHIA)', type: 'NHIA' as const },
    ...NHIA_ACCREDITED_HMOS.map((name) => ({ name, type: 'HMO' as const })),
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const provider of providers) {
    const existing = await prisma.insuranceProvider.findFirst({
      where: { tenantId: tenant.id, name: provider.name },
    });

    if (existing) {
      skippedCount++;
      continue;
    }

    await prisma.insuranceProvider.create({
      data: {
        tenantId: tenant.id,
        name: provider.name,
        type: provider.type,
        isActive: true,
      },
    });
    createdCount++;
  }

  console.log(`Created ${createdCount} providers, skipped ${skippedCount} already present.`);
}

main()
  .catch((e) => {
    console.error('Failed to seed HMO providers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

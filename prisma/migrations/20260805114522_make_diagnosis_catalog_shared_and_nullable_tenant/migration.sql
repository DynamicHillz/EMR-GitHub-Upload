-- DropForeignKey
ALTER TABLE "diagnosis_catalog" DROP CONSTRAINT "diagnosis_catalog_tenantId_fkey";

-- AlterTable
ALTER TABLE "diagnosis_catalog" ALTER COLUMN "tenantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "diagnosis_catalog" ADD CONSTRAINT "diagnosis_catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Postgres treats every NULL as distinct from every other NULL in a unique
-- index, so the existing @@unique([tenantId, code]) does NOT stop duplicate
-- (NULL, 'A09') rows. This partial unique index is what actually keeps
-- shared/global reference rows (tenantId IS NULL) unique by code — and what
-- makes the bulk ICD-10 seed script's `skipDuplicates` behave correctly on
-- re-runs. Prisma's schema DSL has no partial-index syntax, so this is
-- hand-added rather than generated from schema.prisma.
CREATE UNIQUE INDEX "diagnosis_catalog_global_code_key" ON "diagnosis_catalog" ("code") WHERE "tenantId" IS NULL;

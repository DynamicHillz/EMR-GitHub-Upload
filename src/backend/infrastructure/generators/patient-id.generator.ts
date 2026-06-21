/**
 * Patient ID Generator
 *
 * Generates unique patient IDs in the format: PT-YYYY-XXXX
 * where YYYY is the current year and XXXX is a zero-padded sequential number per tenant
 *
 * Example: PT-2026-0001, PT-2026-0002, PT-2026-0003
 *
 * US-PAT-001: Auto-generate unique patient ID
 */
import { PrismaClient } from '@prisma/client';

export class PatientIdGenerator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate the next patient ID for a tenant
   *
   * @param tenantId - The tenant ID
   * @returns Promise<string> - The generated patient ID (e.g., "PT-2026-0001")
   */
  async generatePatientId(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();

    // Count patients registered this year for this tenant
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const patientCount = await this.prisma.patient.count({
      where: {
        tenantId,
        createdAt: {
          gte: yearStart,
          lt: yearEnd,
        },
      },
    });

    // Next sequential number (1-indexed)
    const nextNumber = patientCount + 1;

    // Format as PT-YYYY-XXXX (4-digit zero-padded)
    const patientId = `PT-${year}-${nextNumber.toString().padStart(4, '0')}`;

    // Verify uniqueness (handles race conditions)
    const existing = await this.prisma.patient.findFirst({
      where: { tenantId, patientId },
    });

    if (existing) {
      return this.generatePatientId(tenantId);
    }

    return patientId;
  }

  /**
   * Validate patient ID format
   *
   * @param patientId - The patient ID to validate
   * @returns boolean - True if valid format
   */
  static validatePatientIdFormat(patientId: string): boolean {
    // PT-YYYY-XXXX format
    const regex = /^PT-\d{4}-\d{4}$/;
    return regex.test(patientId);
  }

  /**
   * Extract sequence number from patient ID
   *
   * @param patientId - The patient ID (e.g., "PT-2026-0123")
   * @returns number - The sequence number (e.g., 123)
   */
  static extractSequenceNumber(patientId: string): number {
    if (!this.validatePatientIdFormat(patientId)) {
      throw new Error(`Invalid patient ID format: ${patientId}`);
    }
    // Extract last segment after final dash
    const parts = patientId.split('-');
    return parseInt(parts[2], 10);
  }
}

/**
 * Singleton instance for use across the application
 */
let patientIdGenerator: PatientIdGenerator | null = null;

export function getPatientIdGenerator(prisma: PrismaClient): PatientIdGenerator {
  if (!patientIdGenerator) {
    patientIdGenerator = new PatientIdGenerator(prisma);
  }
  return patientIdGenerator;
}
/**
 * Submit Lab Results Use Case
 *
 * Business logic for submitting lab test results with auto-flagging
 * REQ-LAB-3: Structured result entry with reference ranges
 * REQ-LAB-4: Auto-flag abnormal results
 */

import { PrismaClient } from '@prisma/client';

export interface LabResultItem {
  parameter: string;
  value: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string; // For non-numeric ranges like "Negative", "Normal", etc.
}

export interface SubmitLabResultsDto {
  results: LabResultItem[];
  resultNotes?: string;
}

export interface AbnormalFlag {
  parameter: string;
  value: string;
  referenceRange: string;
  severity: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | 'ABNORMAL';
}

export class SubmitLabResultsUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    labTestId: string,
    dto: SubmitLabResultsDto,
    tenantId: string
  ): Promise<void> {
    // Verify lab test exists and is in correct status
    const labTest = await this.prisma.labTest.findFirst({
      where: {
        id: labTestId,
        tenantId,
      },
    });

    if (!labTest) {
      throw new Error('Lab test not found');
    }

    if (labTest.status !== 'IN_PROGRESS') {
      throw new Error('Can only submit results for tests that are IN_PROGRESS');
    }

    // Auto-flag abnormal results
    const abnormalFlags = this.flagAbnormalResults(dto.results);

    // Prepare reference ranges for storage
    const referenceRanges = this.prepareReferenceRanges(dto.results);

    // Update lab test with results
    await this.prisma.labTest.update({
      where: {
        id: labTestId,
      },
      data: {
        results: JSON.stringify(dto.results),
        resultNotes: dto.resultNotes,
        referenceRanges: JSON.stringify(referenceRanges),
        abnormalFlags: abnormalFlags.length > 0 ? JSON.stringify(abnormalFlags) : null,
        status: 'COMPLETED',
      },
    });
  }

  /**
   * Flag abnormal results based on reference ranges
   * REQ-LAB-4: Auto-flag abnormal results outside reference ranges
   */
  private flagAbnormalResults(results: LabResultItem[]): AbnormalFlag[] {
    const flags: AbnormalFlag[] = [];

    for (const result of results) {
      // For numeric values with min/max ranges
      if (
        result.referenceMin !== undefined ||
        result.referenceMax !== undefined
      ) {
        const numericValue = parseFloat(result.value);

        if (!isNaN(numericValue)) {
          // Check for critical values (20% beyond normal range)
          if (result.referenceMax !== undefined) {
            const criticalHigh = result.referenceMax * 1.2;

            if (numericValue >= criticalHigh) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(result),
                severity: 'CRITICAL_HIGH',
              });
              continue;
            }

            if (numericValue > result.referenceMax) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(result),
                severity: 'HIGH',
              });
              continue;
            }
          }

          if (result.referenceMin !== undefined) {
            const criticalLow = result.referenceMin * 0.8;

            if (numericValue <= criticalLow) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(result),
                severity: 'CRITICAL_LOW',
              });
              continue;
            }

            if (numericValue < result.referenceMin) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(result),
                severity: 'LOW',
              });
              continue;
            }
          }
        }
      }
      // For non-numeric reference ranges
      else if (result.referenceRange) {
        const normalValues = result.referenceRange
          .toLowerCase()
          .split(',')
          .map((v) => v.trim());

        if (!normalValues.includes(result.value.toLowerCase().trim())) {
          flags.push({
            parameter: result.parameter,
            value: result.value,
            referenceRange: result.referenceRange,
            severity: 'ABNORMAL',
          });
        }
      }
    }

    return flags;
  }

  /**
   * Format reference range for display
   */
  private formatReferenceRange(result: LabResultItem): string {
    if (result.referenceRange) {
      return result.referenceRange;
    }

    if (result.referenceMin !== undefined && result.referenceMax !== undefined) {
      return `${result.referenceMin}-${result.referenceMax} ${result.unit}`;
    }

    if (result.referenceMin !== undefined) {
      return `>${result.referenceMin} ${result.unit}`;
    }

    if (result.referenceMax !== undefined) {
      return `<${result.referenceMax} ${result.unit}`;
    }

    return 'N/A';
  }

  /**
   * Prepare reference ranges for storage
   */
  private prepareReferenceRanges(
    results: LabResultItem[]
  ): Record<string, any> {
    const ranges: Record<string, any> = {};

    for (const result of results) {
      ranges[result.parameter] = {
        min: result.referenceMin,
        max: result.referenceMax,
        range: result.referenceRange,
        unit: result.unit,
      };
    }

    return ranges;
  }
}

/**
 * Submit Lab Results Use Case
 *
 * Business logic for submitting lab test results with auto-flagging
 * REQ-LAB-3: Structured result entry with reference ranges
 * REQ-LAB-4: Auto-flag abnormal results
 */

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../../services/notification.service';
import { parseNumericRange } from '../../../shared/utils/lab-range.utils';

interface ParameterRange {
  min?: number;
  max?: number;
  rawRange?: string | null;
}

export interface LabResultItem {
  parameter: string;
  value: string;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string; // For non-numeric ranges like "Negative", "Normal", etc.
  jsonValue?: any; // For complex results like microbiology
}

export interface SubmitLabResultsDto {
  results: LabResultItem[];
  resultNotes?: string;
}

export interface AbnormalFlag {
  parameter: string;
  value: string;
  referenceRange: string;
  severity: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | 'ABNORMAL' | 'INVALID_VALUE';
}

export class SubmitLabResultsUseCase {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService(prisma);
  }

  async execute(
    labTestRecordId: string,
    dto: SubmitLabResultsDto,
    tenantId: string
  ): Promise<void> {
    // Verify lab test exists and is in correct status
    // @ts-ignore - Temporary fix for schema alignment
    const labTestRecord = await this.prisma.labTestRecord.findFirst({
      where: {
        id: labTestRecordId,
        tenantId,
      },
      include: {
        test: {
          include: {
            parameters: {
              include: {
                parameter: true
              }
            }
          }
        },
        order: {
          select: {
            patientId: true,
            orderedById: true,
            patient: { select: { firstName: true, lastName: true, gender: true } }
          }
        }
      }
    });

    if (!labTestRecord) {
      throw new Error('Lab test not found');
    }

    if (labTestRecord.status !== 'IN_PROGRESS') {
      throw new Error('Can only submit results for tests that are IN_PROGRESS');
    }

    // Derive reference ranges from the server-side lab dictionary
    // (LabParameter.refRangeMale/refRangeFemale), gender-selected the same
    // way get-lab-test-by-id.use-case.ts does for display — never from
    // dto.results[i].referenceMin/Max. Those are client-supplied and were
    // previously trusted directly for the CRITICAL_HIGH/CRITICAL_LOW
    // decision: a stale client cache or a unit mismatch (or tampering) could
    // submit a wrong range and suppress a genuinely critical result, leaving
    // the ordering doctor with only a routine notification instead of an
    // urgent one.
    // @ts-ignore - Temporary fix for schema alignment
    const isFemale = labTestRecord.order.patient.gender === 'FEMALE';
    const parameterRanges = new Map<string, ParameterRange>();
    // @ts-ignore - Temporary fix for schema alignment
    for (const tp of labTestRecord.test.parameters) {
      const rawRange = isFemale ? tp.parameter.refRangeFemale : tp.parameter.refRangeMale;
      const { min, max } = parseNumericRange(rawRange);
      parameterRanges.set(tp.parameter.name, { min, max, rawRange });
    }

    const abnormalFlags = this.flagAbnormalResults(dto.results, parameterRanges);

    // Prepare result entries
    const resultPromises = dto.results.map(async (result) => {
      // @ts-ignore - Temporary fix for schema alignment
      const testParam = labTestRecord.test.parameters.find(p => p.parameter.name === result.parameter);
      if (!testParam) return;
      const parameter = testParam.parameter;
      if (!parameter) return;

      const numericValue = parseFloat(result.value);
      const isNumeric = !isNaN(numericValue);
      
      const flag = abnormalFlags.find(f => f.parameter === result.parameter);

      let hasDeltaAlert = false;
      let deltaAlertNotes = null;

      if (isNumeric && parameter.deltaCheckPercentage) {
        // Find the patient's most recent previous result for this parameter
        // @ts-ignore
        const prevResult = await this.prisma.labResultValue.findFirst({
          where: {
            parameterId: parameter.id,
            testRecord: {
              order: {
                patientId: labTestRecord.order.patientId
              },
              status: 'COMPLETED',
              createdAt: {
                lt: labTestRecord.createdAt
              }
            }
          },
          orderBy: {
            enteredAt: 'desc'
          }
        });

        if (prevResult && prevResult.numericValue != null) {
          const change = Math.abs(numericValue - prevResult.numericValue) / prevResult.numericValue * 100;
          if (change >= parameter.deltaCheckPercentage) {
            hasDeltaAlert = true;
            deltaAlertNotes = `Delta Check: Value changed by ${change.toFixed(1)}% compared to previous result of ${prevResult.numericValue} on ${prevResult.enteredAt.toISOString().split('T')[0]}`;
          }
        }
      }

      // @ts-ignore - Temporary fix for schema alignment
      await this.prisma.labResultValue.upsert({
        where: {
          testRecordId_parameterId: {
            testRecordId: labTestRecord.id,
            parameterId: parameter.id
          }
        },
        create: {
          tenantId,
          testRecordId: labTestRecord.id,
          parameterId: parameter.id,
          numericValue: isNumeric ? numericValue : null,
          textValue: !isNumeric && !result.jsonValue ? result.value : null,
          jsonValue: result.jsonValue || null,
          isAbnormal: !!flag,
          isCritical: flag?.severity === 'CRITICAL_HIGH' || flag?.severity === 'CRITICAL_LOW',
          flagType: flag?.severity || null,
          hasDeltaAlert,
          deltaAlertNotes
        },
        update: {
          tenantId,
          numericValue: isNumeric ? numericValue : null,
          textValue: !isNumeric && !result.jsonValue ? result.value : null,
          jsonValue: result.jsonValue || null,
          isAbnormal: !!flag,
          isCritical: flag?.severity === 'CRITICAL_HIGH' || flag?.severity === 'CRITICAL_LOW',
          flagType: flag?.severity || null,
          hasDeltaAlert,
          deltaAlertNotes,
          enteredAt: new Date()
        }
      });
    });

    await Promise.all(resultPromises);

    const hasCritical = abnormalFlags.some(
      (f) => f.severity === 'CRITICAL_HIGH' || f.severity === 'CRITICAL_LOW'
    );

    // Every completed test notifies the ordering doctor exactly once — as
    // CRITICAL_LAB_RESULT when a result is flagged critical, or as the
    // lower-urgency LAB_RESULT_READY otherwise. Previously only the critical
    // case notified at all, so a routine/normal result gave the doctor no
    // signal that anything was ready — they had to remember to go check.
    if (labTestRecord.order.orderedById) {
      // @ts-ignore - Temporary fix for schema alignment
      const patientName = `${labTestRecord.order.patient.firstName} ${labTestRecord.order.patient.lastName}`;
      // @ts-ignore - Temporary fix for schema alignment
      const testName = labTestRecord.test.name;

      if (hasCritical) {
        await this.notificationService.notify(tenantId, labTestRecord.order.orderedById, {
          type: 'CRITICAL_LAB_RESULT',
          severity: 'CRITICAL',
          title: 'Critical Lab Result',
          message: `${patientName} — ${testName} has a critical result`,
          entityType: 'LabOrder',
          entityId: labTestRecord.orderId,
        });
      } else {
        await this.notificationService.notify(tenantId, labTestRecord.order.orderedById, {
          type: 'LAB_RESULT_READY',
          severity: 'INFO',
          title: 'Lab Result Ready',
          message: `${patientName} — ${testName} results are ready for review`,
          entityType: 'LabOrder',
          entityId: labTestRecord.orderId,
        });
      }
    }

    // Update lab test with results notes and status
    // @ts-ignore - Temporary fix for schema alignment
    await this.prisma.labTestRecord.update({
      where: {
        id: labTestRecordId,
      },
      data: {
        reviewNotes: dto.resultNotes, // reusing reviewNotes for resultNotes since resultNotes field was removed, or actually we could just leave it.
        status: 'COMPLETED',
      },
    });
  }

  /**
   * Flag abnormal results based on reference ranges
   * REQ-LAB-4: Auto-flag abnormal results outside reference ranges
   *
   * `ranges` is keyed by parameter name and comes from the server-side lab
   * dictionary (LabParameter.refRangeMale/refRangeFemale) — see execute()
   * above. dto.results[i].referenceMin/Max/Range are NOT used for flagging;
   * only the measured `value` is taken from the submitted result.
   */
  private flagAbnormalResults(results: LabResultItem[], ranges: Map<string, ParameterRange>): AbnormalFlag[] {
    const flags: AbnormalFlag[] = [];

    for (const result of results) {
      const range = ranges.get(result.parameter);
      const { min, max, rawRange } = range || {};

      // For numeric values with min/max ranges
      if (min !== undefined || max !== undefined) {
        const numericValue = parseFloat(result.value);

        if (isNaN(numericValue)) {
          // A blank or unparseable value against a parameter that has a
          // reference range must never be silently stored as "not abnormal"
          // — that's indistinguishable from a genuinely normal result. Flag
          // it explicitly so the UI can surface a "needs re-entry" state.
          flags.push({
            parameter: result.parameter,
            value: result.value,
            referenceRange: this.formatReferenceRange(min, max, rawRange, result.unit),
            severity: 'INVALID_VALUE',
          });
        } else {
          // Check for critical values (20% beyond normal range)
          if (max !== undefined) {
            const criticalHigh = max * 1.2;

            if (numericValue >= criticalHigh) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(min, max, rawRange, result.unit),
                severity: 'CRITICAL_HIGH',
              });
              continue;
            }

            if (numericValue > max) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(min, max, rawRange, result.unit),
                severity: 'HIGH',
              });
              continue;
            }
          }

          if (min !== undefined) {
            const criticalLow = min * 0.8;

            if (numericValue <= criticalLow) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(min, max, rawRange, result.unit),
                severity: 'CRITICAL_LOW',
              });
              continue;
            }

            if (numericValue < min) {
              flags.push({
                parameter: result.parameter,
                value: result.value,
                referenceRange: this.formatReferenceRange(min, max, rawRange, result.unit),
                severity: 'LOW',
              });
              continue;
            }
          }
        }
      }
      // For non-numeric (qualitative) reference ranges, e.g. "Negative", "Non-reactive"
      else if (rawRange) {
        const normalValues = rawRange
          .toLowerCase()
          .split(',')
          .map((v) => v.trim());

        if (!normalValues.includes(result.value.toLowerCase().trim())) {
          flags.push({
            parameter: result.parameter,
            value: result.value,
            referenceRange: rawRange,
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
  private formatReferenceRange(min: number | undefined, max: number | undefined, rawRange: string | null | undefined, unit: string): string {
    if (rawRange) {
      return rawRange;
    }

    if (min !== undefined && max !== undefined) {
      return `${min}-${max} ${unit}`;
    }

    if (min !== undefined) {
      return `>${min} ${unit}`;
    }

    if (max !== undefined) {
      return `<${max} ${unit}`;
    }

    return 'N/A';
  }

}

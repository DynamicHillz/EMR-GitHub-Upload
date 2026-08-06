/**
 * Resolve Diagnosis Code Mapping Use Case
 *
 * Given a diagnosis code in one system, returns its known equivalent(s) in
 * the other system via DiagnosisCodeMapping. Returns an array, not a single
 * guess — WHO's own ICD-10/ICD-11 mapping tables include genuine one-to-many
 * cases (a single source code can legitimately map to several target codes,
 * e.g. a broader ICD-10 category splitting into several more specific
 * ICD-11 codes), so collapsing to one result would silently pick a winner
 * that isn't actually WHO's answer.
 */

import { PrismaClient } from '@prisma/client';

export interface DiagnosisCodeMappingResult {
  targetSystem: string;
  targetCode: string;
  mapKind: string;
  note: string | null;
}

export class ResolveDiagnosisCodeMappingUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(sourceSystem: string, sourceCode: string): Promise<DiagnosisCodeMappingResult[]> {
    const mappings = await this.prisma.diagnosisCodeMapping.findMany({
      where: { sourceSystem, sourceCode },
    });

    return mappings.map((m) => ({
      targetSystem: m.targetSystem,
      targetCode: m.targetCode,
      mapKind: m.mapKind,
      note: m.note,
    }));
  }
}

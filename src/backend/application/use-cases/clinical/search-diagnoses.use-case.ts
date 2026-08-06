/**
 * Search Diagnoses Use Case
 *
 * Extracted from clinical.routes.ts (previously inline route-handler logic)
 * so the codeSystem branching added here is actually unit-testable, matching
 * the rest of the codebase's use-case convention.
 *
 * Two code systems:
 * - ICD-11 (default): calls the local WHO ICD-11 Docker API, upserts each
 *   result as a tenant-scoped DiagnosisCatalog row (so the returned `id` is
 *   a real DB UUID usable as a foreign key), falling back to a local catalog
 *   search if the WHO API call fails.
 * - ICD-10: no live API in this build — WHO's ICD-10 classification is
 *   frozen, so a bulk-imported, shared/global catalog (see
 *   seed-icd10-catalog.ts) is the right fit rather than another live
 *   network dependency. Queries DiagnosisCatalog directly.
 *
 * Both branches' local-catalog searches look at tenant-scoped rows AND
 * shared/global rows (tenantId: null) — see the schema comment on
 * DiagnosisCatalog.tenantId.
 */

import { PrismaClient } from '@prisma/client';

export type DiagnosisCodeSystem = 'ICD-11' | 'ICD-10';

export interface DiagnosisSearchResult {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  description: string | null;
  type: string;
  isActive: boolean;
}

const WHO_ICD11_SEARCH_URL = 'http://127.0.0.1:80/icd/release/11/2026-01/mms/search';
const LOCAL_SEARCH_LIMIT = 20;

function stripHtml(html: string): string {
  return html ? html.replace(/<[^>]*>?/gm, '') : '';
}

export class SearchDiagnosesUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(
    query: string,
    codeSystem: DiagnosisCodeSystem,
    tenantId: string
  ): Promise<DiagnosisSearchResult[]> {
    if (!query) return [];

    if (codeSystem === 'ICD-10') {
      return this.searchLocalCatalog(query, tenantId, 'ICD-10');
    }

    try {
      return await this.searchWhoIcd11(query, tenantId);
    } catch (error) {
      console.error('Error fetching from WHO API:', error);
      try {
        return await this.searchLocalCatalog(query, tenantId, 'ICD-11');
      } catch (fallbackError) {
        console.error('Fallback local search also failed:', fallbackError);
        return [];
      }
    }
  }

  private async searchWhoIcd11(query: string, tenantId: string): Promise<DiagnosisSearchResult[]> {
    const response = await fetch(`${WHO_ICD11_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'API-Version': 'v2',
      },
    });

    if (!response.ok) {
      throw new Error(`WHO API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const entities = data.destinationEntities || [];
    const whoResults = entities
      .filter((entity: any) => entity.theCode)
      .map((entity: any) => ({
        code: entity.theCode,
        name: stripHtml(entity.title),
      }));

    // Upsert each WHO diagnosis into the local DiagnosisCatalog table so the
    // returned `id` is a valid database UUID usable as a foreign key.
    const results: DiagnosisSearchResult[] = [];
    for (const whoResult of whoResults) {
      try {
        const catalogEntry = await this.prisma.diagnosisCatalog.upsert({
          where: {
            tenantId_code: {
              tenantId,
              code: whoResult.code,
            },
          },
          update: {
            name: whoResult.name,
            isActive: true,
          },
          create: {
            tenantId,
            code: whoResult.code,
            name: whoResult.name,
            type: 'ICD-11',
            isActive: true,
          },
        });

        results.push({
          id: catalogEntry.id,
          tenantId: catalogEntry.tenantId,
          code: catalogEntry.code,
          name: catalogEntry.name,
          description: null,
          type: catalogEntry.type,
          isActive: catalogEntry.isActive,
        });
      } catch (upsertError) {
        // If a single upsert fails, skip it but don't break the whole search
        console.error(`Failed to upsert diagnosis ${whoResult.code}:`, upsertError);
      }
    }

    return results;
  }

  private async searchLocalCatalog(
    query: string,
    tenantId: string,
    type: DiagnosisCodeSystem
  ): Promise<DiagnosisSearchResult[]> {
    const localResults = await this.prisma.diagnosisCatalog.findMany({
      where: {
        type,
        isActive: true,
        OR: [{ tenantId }, { tenantId: null }],
        AND: [
          {
            OR: [
              { code: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: LOCAL_SEARCH_LIMIT,
    });

    return localResults.map((d) => ({
      id: d.id,
      tenantId: d.tenantId,
      code: d.code,
      name: d.name,
      description: null,
      type: d.type,
      isActive: d.isActive,
    }));
  }
}

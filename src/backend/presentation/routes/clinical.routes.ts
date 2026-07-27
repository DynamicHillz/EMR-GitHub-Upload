import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { requireRole } from '../middleware/auth';
import { prisma } from '../../infrastructure/database/prisma.client';
const router = Router();

// Any authenticated staff can search diagnoses
const CAN_VIEW = requireRole(['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PHARMACIST', 'LAB_TECH', 'CASHIER']);

router.get('/diagnoses', CAN_VIEW, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No tenant ID found' });
  }

  const { query } = req.query;

  if (!query) {
    return res.json({ success: true, data: [] });
  }

  try {
    // Call the local WHO ICD-11 Docker API explicitly on IPv4
    const response = await fetch(`http://127.0.0.1:80/icd/release/11/2026-01/mms/search?q=${encodeURIComponent(query as string)}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'API-Version': 'v2'
      }
    });

    if (!response.ok) {
      throw new Error(`WHO API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    // Strip HTML <em> tags from WHO titles
    const stripHtml = (html: string) => html ? html.replace(/<[^>]*>?/gm, '') : '';
    
    // Transform to match the Diagnosis frontend interface
    const entities = data.destinationEntities || [];
    const whoResults = entities
      .filter((entity: any) => entity.theCode)
      .map((entity: any) => ({
        code: entity.theCode,
        name: stripHtml(entity.title),
      }));

    // Upsert each WHO diagnosis into the local DiagnosisCatalog table
    // so that the returned `id` is a valid database UUID for foreign keys
    const formattedDiagnoses = [];
    for (const whoResult of whoResults) {
      try {
        const catalogEntry = await prisma.diagnosisCatalog.upsert({
          where: {
            tenantId_code: {
              tenantId,
              code: whoResult.code,
            }
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
          }
        });

        formattedDiagnoses.push({
          id: catalogEntry.id, // Real database UUID
          tenantId,
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

    console.log(`Sending ${formattedDiagnoses.length} diagnoses back to UI for query "${query}"`);
    res.json({
      success: true,
      data: formattedDiagnoses
    });
  } catch (error) {
    console.error('Error fetching from WHO API:', error);
    // Fallback: search local catalog instead
    try {
      const localResults = await prisma.diagnosisCatalog.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { code: { contains: query as string, mode: 'insensitive' } },
            { name: { contains: query as string, mode: 'insensitive' } },
          ]
        },
        take: 20,
      });
      res.json({
        success: true,
        data: localResults.map(d => ({
          id: d.id,
          tenantId: d.tenantId,
          code: d.code,
          name: d.name,
          description: null,
          type: d.type,
          isActive: d.isActive,
        }))
      });
    } catch (fallbackError) {
      console.error('Fallback local search also failed:', fallbackError);
      res.json({ success: true, data: [] });
    }
  }
}));

export default router;

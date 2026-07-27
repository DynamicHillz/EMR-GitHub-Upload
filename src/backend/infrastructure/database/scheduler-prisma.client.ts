/**
 * Scheduler Prisma Client
 *
 * A separate PrismaClient instance with a small, explicit connection_limit,
 * used only by background jobs (scheduler.service.ts). Keeps a slow/heavy
 * scheduled query from starving the connection pool that live requests
 * depend on — the shared singleton (prisma.client.ts) has no explicit
 * limit and would otherwise be shared between both.
 */

import { PrismaClient } from '@prisma/client';

function withConnectionLimit(baseUrl: string, limit: number): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}connection_limit=${limit}`;
}

export const schedulerPrisma = new PrismaClient({
  datasources: {
    db: {
      url: withConnectionLimit(process.env.DATABASE_URL || '', 2),
    },
  },
});

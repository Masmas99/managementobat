import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const TRANSIENT_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1012',
  'P1013',
  'P1017',
  'P2024',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

export function isDbConnectionError(error) {
  if (!error) return false;
  if (TRANSIENT_CODES.has(error.code)) return true;
  const cause = error.cause;
  if (cause && TRANSIENT_CODES.has(cause.code)) return true;
  const message = String(error.message || '');
  return /Can't reach database server|Connection terminated|Connection refused|ETIMEDOUT|ENOTFOUND|ECONNRESET|Timed out fetching a new connection/i.test(message);
}

export async function withDbRetry(query, { attempts = 3, delayMs = 350 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await query();
    } catch (error) {
      lastError = error;
      const retryable = isDbConnectionError(error) && attempt < attempts - 1;
      if (!retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

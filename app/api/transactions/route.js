import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

const transactionsPath = path.join(process.cwd(), 'data', 'transactions.json');
const useDatabase = Boolean(process.env.DATABASE_URL);

export async function GET() {
  if (useDatabase) {
    try {
      const transactions = await prisma.stockTransaction.findMany({ include: { inventory: true }, orderBy: { createdAt: 'desc' } });
      return Response.json({ data: transactions });
    } catch {
      // Keep read-only activity views usable during a temporary database outage.
    }
  }
  const transactions = JSON.parse(await fs.readFile(transactionsPath, 'utf8'));
  return Response.json({ data: transactions });
}

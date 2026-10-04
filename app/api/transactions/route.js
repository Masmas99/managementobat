import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { serializeTransaction, stockInclude } from '@/lib/inventory';

const transactionsPath = path.join(process.cwd(), 'data', 'transactions.json');
const useDatabase = Boolean(process.env.DATABASE_URL);

export async function GET() {
  if (useDatabase) {
    try {
      const transactions = await prisma.stockTransaction.findMany({ include: { batchStock: { include: stockInclude } }, orderBy: { createdAt: 'desc' } });
      return Response.json({ data: transactions.map(serializeTransaction) });
    } catch {
      // Read-only activity remains available from the local fallback file.
    }
  }
  return Response.json({ data: JSON.parse(await fs.readFile(transactionsPath, 'utf8')) });
}

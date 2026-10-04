export const stockInclude = {
  batch: {
    include: {
      product: { include: { categoryRef: true } },
      supplier: true,
    },
  },
  location: true,
};

export function serializeStock(stock) {
  const product = stock.batch?.product;
  const batch = stock.batch;
  const isExpired = batch?.expiryDate && new Date(batch.expiryDate).getTime() < Date.now();
  return {
    id: stock.id,
    productId: product?.id,
    batchId: batch?.id,
    name: product?.name || '',
    generic: product?.genericName || '',
    strength: product?.strength || '',
    dosageForm: product?.dosageForm || '',
    route: product?.route || '',
    category: product?.category || product?.categoryRef?.name || '',
    gtin: product?.gtin || '',
    registrationNo: product?.registrationNo || '',
    manufacturer: product?.manufacturer || batch?.manufacturer || '',
    batch: batch?.batchNumber || '',
    manufacturedAt: batch?.manufacturedAt?.toISOString?.().slice(0, 10) || null,
    nearestExpiry: batch?.expiryDate instanceof Date ? batch.expiryDate.toISOString().slice(0, 10) : batch?.expiryDate,
    expiryDate: batch?.expiryDate instanceof Date ? batch.expiryDate.toISOString().slice(0, 10) : batch?.expiryDate,
    supplier: batch?.supplier?.name || '',
    supplierId: batch?.supplierId || null,
    location: stock.location?.name || '',
    locationId: stock.locationId || null,
    stock: stock.quantity,
    minimum: stock.minimum,
    unitPrice: stock.unitPrice,
    status: stock.status === 'OUT_OF_STOCK' ? 'OUT OF STOCK' : stock.status === 'LOW_STOCK' ? 'LOW STOCK' : stock.status,
    batchStatus: isExpired ? 'EXPIRED' : (batch?.status || 'RELEASED'),
    createdAt: stock.createdAt,
    updatedAt: stock.updatedAt,
  };
}

export function serializeTransaction(transaction) {
  const stock = serializeStock(transaction.batchStock);
  return {
    id: transaction.id,
    batchStockId: transaction.batchStockId,
    inventoryId: transaction.batchStockId,
    type: transaction.type,
    quantity: transaction.quantity,
    stockBefore: transaction.stockBefore,
    stockAfter: transaction.stockAfter,
    createdAt: transaction.createdAt,
    name: stock.name,
    batch: stock.batch,
    inventory: stock,
  };
}

export function serializeAdjustment(adjustment) {
  const stock = serializeStock(adjustment.batchStock);
  return {
    id: adjustment.id,
    batchStockId: adjustment.batchStockId,
    inventoryId: adjustment.batchStockId,
    stockBefore: adjustment.stockBefore,
    physicalStock: adjustment.physicalStock,
    difference: adjustment.difference,
    reason: adjustment.reason,
    createdAt: adjustment.createdAt,
    name: stock.name,
    batch: stock.batch,
    inventory: stock,
  };
}

export function stockStatus(quantity, minimum) {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity < minimum) return 'LOW_STOCK';
  return 'NORMAL';
}

export function makeBatchId(productId, batchNumber) {
  return `BATCH-${productId}-${batchNumber}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function makeStockId(batchId, locationId) {
  return `STOCK-${batchId}-${locationId || 'UNASSIGNED'}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

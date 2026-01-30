import { storeRepo } from './storeRepo';
import type { FiscalEvent } from './fiscalLedger';
import type { Product, Sale } from '../types';

/**
 * Event-sourced derivation
 * ------------------------
 * Rebuilds derived views (sales list, product stock) from immutable events.
 * This is a conservative implementation to avoid breaking existing state:
 * - Processes events in seq order (monotonic per store)
 * - Applies SALE_COMPLETED, SALE_REFUNDED, STOCK_ADJUSTED
 * - Returns fresh arrays; caller decides whether to adopt them.
 */

export interface DerivedState {
  products: Product[];
  sales: Sale[];
}

export async function deriveStateFromEvents(storeId: string, baseProducts: Product[]): Promise<DerivedState> {
  const events = (await storeRepo.getEvents(storeId)) as FiscalEvent[];
  if (!events || events.length === 0) {
    return {
      products: baseProducts,
      sales: []
    };
  }

  const sorted = [...events].sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const productsMap = new Map<string, Product>();
  baseProducts.forEach(p => productsMap.set(p.id, { ...p }));

  const salesMap = new Map<string, Sale>();

  for (const ev of sorted) {
    if (ev.type === 'SALE_COMPLETED') {
      // Create or overwrite sale snapshot
      const sale: Sale = {
        id: ev.saleId,
        storeId: ev.storeId,
        timestamp: ev.timestamp,
        items: ev.items.map(i => {
          const base = productsMap.get(i.id);
          return {
            ...(base || ({} as Product)),
            id: i.id,
            name: i.name,
            sku: i.sku,
            price: i.price,
            quantity: i.quantity
          };
        }),
        subtotal: ev.subtotal,
        tax: ev.tax,
        total: ev.total,
        paymentMethod: ev.paymentMethod,
        receiptNumber: ev.receiptNumber,
        status: 'completed'
      };
      salesMap.set(ev.saleId, sale);

      // Apply stock decrease
      ev.items.forEach(item => {
        const p = productsMap.get(item.id);
        if (!p) return;
        const newStock = Math.max(0, (p.stock || 0) - item.quantity);
        productsMap.set(item.id, { ...p, stock: newStock });
      });
    }

    if (ev.type === 'SALE_REFUNDED') {
      const existing = salesMap.get(ev.saleId);
      if (existing) {
        salesMap.set(ev.saleId, {
          ...existing,
          status: 'refunded',
          refundedAt: ev.timestamp
        });
      }
      // Restock quantities for RETURN_TO_STOCK
      if (ev.writeOffType !== 'WRITE_OFF') {
        ev.refundedItems.forEach(line => {
          const p = productsMap.get(line.productId);
          if (!p) return;
          const newStock = (p.stock || 0) + line.quantity;
          productsMap.set(line.productId, { ...p, stock: newStock });
        });
      }
    }

    if (ev.type === 'STOCK_ADJUSTED') {
      const p = productsMap.get(ev.productId);
      if (!p) continue;
      productsMap.set(ev.productId, {
        ...p,
        stock: ev.newStock
      });
    }
  }

  return {
    products: Array.from(productsMap.values()),
    sales: Array.from(salesMap.values())
  };
}


import { storeRepo } from './storeRepo';
import { localDb } from './localDb';
import type { CartItem, Sale, User } from '../types';

/**
 * Immutable Fiscal Ledger
 * -----------------------
 * All fiscal-relevant events (sales, refunds, stock moves, etc.) are captured
 * as append-only events per store + terminal.
 *
 * Phase 1:
 * - Capture events alongside existing mutable collections (sales/products)
 * - Guarantee a monotonic event sequence per store for conflict resolution
 * - Use these events as the source of truth for fiscal reports going forward
 */

export type FiscalEventType =
  | 'SALE_COMPLETED'
  | 'SALE_REFUNDED'
  | 'STOCK_ADJUSTED'
  | 'CASH_DRAWER_OPENED'
  | 'PURCHASE_ORDER_RECEIVED'
  | 'STOCK_TRANSFER';

export interface FiscalEventBase {
  id: string;
  storeId: string;
  /**
   * Monotonic sequence per store, used for ordering + conflict resolution.
   */
  seq: number;
  /**
   * Optional client-side terminal identifier for multi-terminal stores.
   */
  terminalId?: string;
  type: FiscalEventType;
  timestamp: string;
  userId: string;
  userName: string;
}

export interface SaleCompletedEvent extends FiscalEventBase {
  type: 'SALE_COMPLETED';
  saleId: string;
  receiptNumber?: string;
  total: number;
  subtotal: number;
  tax: number;
  paymentMethod: Sale['paymentMethod'];
  items: Array<Pick<CartItem, 'id' | 'name' | 'sku' | 'price' | 'quantity'>>;
}

export interface SaleRefundedEvent extends FiscalEventBase {
  type: 'SALE_REFUNDED';
  saleId: string;
  receiptNumber?: string;
  /**
   * For future partial refunds, we support per-line quantities.
   */
  refundedItems: Array<{
    productId: string;
    quantity: number;
    lineTotal: number;
  }>;
  reason?: string;
  writeOffType?: 'RETURN_TO_STOCK' | 'WRITE_OFF';
}

export interface StockAdjustedEvent extends FiscalEventBase {
  type: 'STOCK_ADJUSTED';
  productId: string;
  change: number;
  previousStock: number;
  newStock: number;
  reason: string;
}

export type FiscalEvent =
  | SaleCompletedEvent
  | SaleRefundedEvent
  | StockAdjustedEvent;

async function nextEventSeq(storeId: string): Promise<number> {
  return localDb.nextEventSeq(storeId);
}

export const fiscalLedger = {
  /**
   * Append a single event (or array of events) to the immutable ledger.
   * Also persists via storeRepo so it participates in IndexedDB + sync.
   */
  async append(storeId: string, events: Omit<FiscalEvent, 'seq'> | Array<Omit<FiscalEvent, 'seq'>>) {
    const list = Array.isArray(events) ? events : [events];

    const withSeq: FiscalEvent[] = [];
    for (const ev of list) {
      const seq = await nextEventSeq(storeId);
      withSeq.push({ ...(ev as any), seq });
    }

    await storeRepo.appendEvents(storeId, withSeq);
  },

  async recordSaleCompleted(sale: Sale, user: User, terminalId?: string) {
    const event: Omit<SaleCompletedEvent, 'seq'> = {
      id: `EVT-SALE-${sale.id}`,
      storeId: sale.storeId,
      terminalId,
      type: 'SALE_COMPLETED',
      timestamp: sale.timestamp || new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      total: sale.total,
      subtotal: sale.subtotal,
      tax: sale.tax,
      paymentMethod: sale.paymentMethod,
      items: sale.items.map(i => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        price: i.price,
        quantity: i.quantity
      }))
    };

    await this.append(sale.storeId, event);
  },

  async recordSaleRefunded(sale: Sale, user: User, opts?: { reason?: string; writeOffType?: 'RETURN_TO_STOCK' | 'WRITE_OFF' }) {
    // Conflict policy: only one refund event allowed per sale id.
    const existingEvents = (await storeRepo.getEvents(sale.storeId)) as FiscalEvent[];
    if (existingEvents.some(e => e.type === 'SALE_REFUNDED' && e.saleId === sale.id)) {
      return;
    }
    const event: Omit<SaleRefundedEvent, 'seq'> = {
      id: `EVT-REFUND-${sale.id}-${Date.now()}`,
      storeId: sale.storeId,
      type: 'SALE_REFUNDED',
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      refundedItems: sale.items.map(i => ({
        productId: i.id,
        quantity: i.quantity,
        lineTotal: i.price * i.quantity
      })),
      reason: opts?.reason,
      writeOffType: opts?.writeOffType ?? 'RETURN_TO_STOCK'
    };

    await this.append(sale.storeId, event);
  },

  async recordStockAdjustment(params: {
    storeId: string;
    user: User;
    productId: string;
    change: number;
    previousStock: number;
    newStock: number;
    reason: string;
  }) {
    const { storeId, user, productId, change, previousStock, newStock, reason } = params;
    const event: Omit<StockAdjustedEvent, 'seq'> = {
      id: `EVT-STOCK-${productId}-${Date.now()}`,
      storeId,
      type: 'STOCK_ADJUSTED',
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      productId,
      change,
      previousStock,
      newStock,
      reason
    };

    await this.append(storeId, event);
  }
};


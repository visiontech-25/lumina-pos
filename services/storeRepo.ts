import type {
  AuditEntry,
  BusinessSettings,
  Product,
  Prospect,
  Sale,
  Supplier,
  User,
  Customer,
  LoyaltyAccount,
  Promotion,
  PriceList,
  TaxConfig,
  PurchaseOrder,
  GoodsReceipt,
  StockTransfer,
  StockCountSession,
  RestaurantSection,
  RestaurantTable,
  RestaurantOrder,
  FiscalReport,
  StoreLocation,
  LabelTemplate
} from '../types';
import { localDb, type OutboxItem } from './localDb';

type CollectionName =
  | 'products'
  | 'suppliers'
  | 'sales'
  | 'prospects'
  | 'users'
  | 'auditLogs'
  | 'events'
  | 'customers'
  | 'loyalty'
  | 'promotions'
  | 'priceLists'
  | 'taxConfig'
  | 'purchaseOrders'
  | 'goodsReceipts'
  | 'stockTransfers'
  | 'stockCounts'
  | 'restaurantSections'
  | 'restaurantTables'
  | 'restaurantOrders'
  | 'fiscalReports'
  | 'storeLocations'
  | 'labelTemplates';

function lsKey(storeId: string, key: string) {
  return `lumina_${storeId}_${key}`;
}

async function getWithFallback<T>(storeId: string, key: string, idbGetter: () => Promise<T | undefined>, fallback: T): Promise<T> {
  // 1) IndexedDB first (preferred)
  try {
    const v = await idbGetter();
    if (v !== undefined) return v;
  } catch {
    // ignore and fall back
  }

  // 2) LocalStorage fallback (legacy)
  const saved = localStorage.getItem(lsKey(storeId, key));
  if (!saved) return fallback;
  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

async function setBoth(storeId: string, key: string, value: any, idbSetter: () => Promise<void>) {
  // Write to IDB best-effort
  try {
    await idbSetter();
  } catch {
    // ignore
  }
  // Keep LocalStorage in sync for now (so older code paths still work)
  localStorage.setItem(lsKey(storeId, key), JSON.stringify(value));
}

export const storeRepo = {
  async getCollection(storeId: string, name: CollectionName, fallback: any[] = []) {
    return getWithFallback<any[]>(
      storeId,
      name,
      async () => (await localDb.getCollection(storeId, name)) as any[] | undefined,
      fallback
    );
  },

  async setCollection(storeId: string, name: CollectionName, value: any[]) {
    return setBoth(storeId, name, value, async () => localDb.setCollection(storeId, name, value as any));
  },

  async getSettings(storeId: string, fallback: BusinessSettings) {
    return getWithFallback<BusinessSettings>(storeId, 'settings', async () => localDb.getSettings(storeId), fallback);
  },

  async setSettings(storeId: string, settings: BusinessSettings) {
    return setBoth(storeId, 'settings', settings, async () => localDb.setSettings(storeId, settings));
  },

  async nextReceiptSeq(storeId: string): Promise<number> {
    // Prefer IDB counter; mirror to LocalStorage for compatibility
    try {
      const next = await localDb.nextReceiptSeq(storeId);
      localStorage.setItem(lsKey(storeId, 'receipt_seq'), String(next));
      return next;
    } catch {
      const key = lsKey(storeId, 'receipt_seq');
      const seq = Number(localStorage.getItem(key) || '0') + 1;
      localStorage.setItem(key, String(seq));
      return seq;
    }
  },

  async getOutbox(storeId: string): Promise<OutboxItem[]> {
    return getWithFallback<OutboxItem[]>(storeId, 'sync_outbox', async () => localDb.getOutbox(storeId), []);
  },

  async setOutbox(storeId: string, items: OutboxItem[]) {
    return setBoth(storeId, 'sync_outbox', items, async () => localDb.setOutbox(storeId, items));
  },

  /**
   * Immutable fiscal events API (append-only).
   * These are the source of truth for sales, refunds, stock moves, etc.
   */
  async getEvents(storeId: string): Promise<any[]> {
    return this.getCollection(storeId, 'events', []);
  },

  async appendEvents(storeId: string, events: any | any[]): Promise<void> {
    const list = Array.isArray(events) ? events : [events];
    const existing = (await this.getEvents(storeId)) ?? [];
    const next = [...existing, ...list];
    await this.setCollection(storeId, 'events', next);
  },

  // Customers / loyalty
  async getCustomers(storeId: string): Promise<Customer[]> {
    return this.getCollection(storeId, 'customers', []);
  },
  async setCustomers(storeId: string, customers: Customer[]) {
    await this.setCollection(storeId, 'customers', customers);
  },
  async getLoyaltyAccounts(storeId: string): Promise<LoyaltyAccount[]> {
    return this.getCollection(storeId, 'loyalty', []);
  },
  async setLoyaltyAccounts(storeId: string, items: LoyaltyAccount[]) {
    await this.setCollection(storeId, 'loyalty', items);
  },

  // Promotions / price lists / tax
  async getPromotions(storeId: string): Promise<Promotion[]> {
    return this.getCollection(storeId, 'promotions', []);
  },
  async setPromotions(storeId: string, items: Promotion[]) {
    await this.setCollection(storeId, 'promotions', items);
  },
  async getPriceLists(storeId: string): Promise<PriceList[]> {
    return this.getCollection(storeId, 'priceLists', []);
  },
  async setPriceLists(storeId: string, items: PriceList[]) {
    await this.setCollection(storeId, 'priceLists', items);
  },
  async getTaxConfig(storeId: string): Promise<TaxConfig | undefined> {
    return getWithFallback<TaxConfig | undefined>(
      storeId,
      'taxConfig',
      async () => (await localDb.getCollection(storeId, 'taxConfig')) as TaxConfig | undefined,
      undefined as any
    );
  },
  async setTaxConfig(storeId: string, config: TaxConfig) {
    await setBoth(storeId, 'taxConfig', config, async () => localDb.setCollection(storeId, 'taxConfig', config as any));
  },

  // Operational documents (POs, transfers, counts)
  async getPurchaseOrders(storeId: string): Promise<PurchaseOrder[]> {
    return this.getCollection(storeId, 'purchaseOrders', []);
  },
  async setPurchaseOrders(storeId: string, items: PurchaseOrder[]) {
    await this.setCollection(storeId, 'purchaseOrders', items);
  },
  async getGoodsReceipts(storeId: string): Promise<GoodsReceipt[]> {
    return this.getCollection(storeId, 'goodsReceipts', []);
  },
  async setGoodsReceipts(storeId: string, items: GoodsReceipt[]) {
    await this.setCollection(storeId, 'goodsReceipts', items);
  },
  async getStockTransfers(storeId: string): Promise<StockTransfer[]> {
    return this.getCollection(storeId, 'stockTransfers', []);
  },
  async setStockTransfers(storeId: string, items: StockTransfer[]) {
    await this.setCollection(storeId, 'stockTransfers', items);
  },
  async getStockCounts(storeId: string): Promise<StockCountSession[]> {
    return this.getCollection(storeId, 'stockCounts', []);
  },
  async setStockCounts(storeId: string, items: StockCountSession[]) {
    await this.setCollection(storeId, 'stockCounts', items);
  },

  // Restaurant mode
  async getRestaurantSections(storeId: string): Promise<RestaurantSection[]> {
    return this.getCollection(storeId, 'restaurantSections', []);
  },
  async setRestaurantSections(storeId: string, items: RestaurantSection[]) {
    await this.setCollection(storeId, 'restaurantSections', items);
  },
  async getRestaurantTables(storeId: string): Promise<RestaurantTable[]> {
    return this.getCollection(storeId, 'restaurantTables', []);
  },
  async setRestaurantTables(storeId: string, items: RestaurantTable[]) {
    await this.setCollection(storeId, 'restaurantTables', items);
  },
  async getRestaurantOrders(storeId: string): Promise<RestaurantOrder[]> {
    return this.getCollection(storeId, 'restaurantOrders', []);
  },
  async setRestaurantOrders(storeId: string, items: RestaurantOrder[]) {
    await this.setCollection(storeId, 'restaurantOrders', items);
  },

  // Fiscal reports
  async getFiscalReports(storeId: string): Promise<FiscalReport[]> {
    return this.getCollection(storeId, 'fiscalReports', []);
  },
  async setFiscalReports(storeId: string, items: FiscalReport[]) {
    await this.setCollection(storeId, 'fiscalReports', items);
  },

  // Multi-location
  async getStoreLocations(storeId: string): Promise<StoreLocation[]> {
    return this.getCollection(storeId, 'storeLocations', []);
  },
  async setStoreLocations(storeId: string, items: StoreLocation[]) {
    await this.setCollection(storeId, 'storeLocations', items);
  },

  // Label templates
  async getLabelTemplates(storeId: string): Promise<LabelTemplate[]> {
    return this.getCollection(storeId, 'labelTemplates', []);
  },
  async setLabelTemplates(storeId: string, items: LabelTemplate[]) {
    await this.setCollection(storeId, 'labelTemplates', items);
  }
};

// Explicit types to help imports elsewhere
export type { CollectionName };
export type { Product, Supplier, Sale, Prospect, User, AuditEntry };


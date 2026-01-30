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

/**
 * IndexedDB Offline Store
 * - Per-store collections (products/sales/etc)
 * - Metadata (settings, receipt counter)
 * - Sync outbox queue
 *
 * Design goal: replace LocalStorage for scale + reliability, without adding dependencies.
 */

const DB_NAME = 'lumina_pos';
// Bump version when we introduce new key patterns or migration logic
const DB_VERSION = 2;

type CollectionName =
  | 'products'
  | 'suppliers'
  | 'sales'
  | 'prospects'
  | 'users'
  | 'auditLogs'
  // Immutable fiscal events (sales, refunds, stock moves, cash drawer, etc.)
  | 'events'
  // Master data
  | 'customers'
  | 'loyalty'
  | 'promotions'
  | 'priceLists'
  | 'taxConfig'
  // Operational documents
  | 'purchaseOrders'
  | 'goodsReceipts'
  | 'stockTransfers'
  | 'stockCounts'
  // Restaurant mode
  | 'restaurantSections'
  | 'restaurantTables'
  | 'restaurantOrders'
  // Fiscal reports
  | 'fiscalReports'
  // Multi-location
  | 'storeLocations'
  // Label templates
  | 'labelTemplates';

export interface OutboxItem {
  id: string;
  storeId: string;
  collection: CollectionName | string;
  action: 'SET' | 'DELETE' | 'BULK_SET';
  payload: any;
  timestamp: string;
  retryCount: number;
}

type StoreKey =
  | `c:${string}:${CollectionName}` // collection payload (array)
  | `settings:${string}` // BusinessSettings
  | `receiptSeq:${string}` // number
  | `outbox:${string}` // OutboxItem[]
  /**
   * Monotonic sequence for fiscal events per store.
   * Used to guarantee ordering for multi-terminal setups.
   */
  | `eventSeq:${string}`;

type StoreValue =
  | Product[]
  | Supplier[]
  | Sale[]
  | Prospect[]
  | User[]
  | AuditEntry[]
  | BusinessSettings
  | number
  | OutboxItem[]
  | Customer[]
  | LoyaltyAccount[]
  | Promotion[]
  | PriceList[]
  | TaxConfig
  | PurchaseOrder[]
  | GoodsReceipt[]
  | StockTransfer[]
  | StockCountSession[]
  | any[]; // Restaurant sections, tables, orders, fiscal reports, locations, label templates

function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function kvGet<T>(key: StoreKey): Promise<T | undefined> {
  if (!isIdbAvailable()) return undefined;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const store = tx.objectStore('kv');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function kvSet<T>(key: StoreKey, value: T): Promise<void> {
  if (!isIdbAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    const store = tx.objectStore('kv');
    const req = store.put(value as any, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const localDb = {
  /**
   * Collections
   */
  async getCollection(storeId: string, name: CollectionName): Promise<StoreValue | undefined> {
    return kvGet<StoreValue>(`c:${storeId}:${name}`);
  },
  async setCollection(storeId: string, name: CollectionName, value: StoreValue): Promise<void> {
    await kvSet(`c:${storeId}:${name}`, value);
  },

  /**
   * Settings
   */
  async getSettings(storeId: string): Promise<BusinessSettings | undefined> {
    return kvGet<BusinessSettings>(`settings:${storeId}`);
  },
  async setSettings(storeId: string, settings: BusinessSettings): Promise<void> {
    await kvSet(`settings:${storeId}`, settings);
  },

  /**
   * Receipt sequence (monotonic counter per store).
   */
  async nextReceiptSeq(storeId: string): Promise<number> {
    const key: StoreKey = `receiptSeq:${storeId}`;
    const current = (await kvGet<number>(key)) ?? 0;
    const next = current + 1;
    await kvSet(key, next);
    return next;
  },

  /**
   * Event sequence (monotonic counter per store) for immutable ledger.
   */
  async nextEventSeq(storeId: string): Promise<number> {
    const key: StoreKey = `eventSeq:${storeId}`;
    const current = (await kvGet<number>(key)) ?? 0;
    const next = current + 1;
    await kvSet(key, next);
    return next;
  },

  /**
   * Outbox for cloud sync (per store).
   */
  async getOutbox(storeId: string): Promise<OutboxItem[]> {
    return (await kvGet<OutboxItem[]>(`outbox:${storeId}`)) ?? [];
  },
  async setOutbox(storeId: string, items: OutboxItem[]): Promise<void> {
    await kvSet(`outbox:${storeId}`, items);
  }
};


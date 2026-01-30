import { storeRepo } from './storeRepo';
import type { BusinessSettings, Product, Supplier, Sale, Prospect, User, AuditEntry } from '../types';

/**
 * Background / IndexedDB migration from legacy LocalStorage.
 *
 * Phase 1:
 * - On first run per store, read legacy lumina_{storeId}_* keys
 * - Write them through storeRepo (IndexedDB + mirrored LocalStorage)
 * - Mark a per-store flag to avoid repeating
 */

const MIGRATION_FLAG_PREFIX = 'lumina_migrated_store_v1_';

function lsKey(storeId: string, key: string) {
  return `lumina_${storeId}_${key}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function runStoreMigrationIfNeeded(storeId: string, defaults: {
  products: Product[];
  suppliers: Supplier[];
  settings: BusinessSettings;
}) {
  const flagKey = `${MIGRATION_FLAG_PREFIX}${storeId}`;
  if (localStorage.getItem(flagKey) === 'done') return;

  const products = safeParse<Product[]>(localStorage.getItem(lsKey(storeId, 'products')), defaults.products);
  const suppliers = safeParse<Supplier[]>(localStorage.getItem(lsKey(storeId, 'suppliers')), defaults.suppliers);
  const sales = safeParse<Sale[]>(localStorage.getItem(lsKey(storeId, 'sales')), []);
  const prospects = safeParse<Prospect[]>(localStorage.getItem(lsKey(storeId, 'prospects')), []);
  const users = safeParse<User[]>(localStorage.getItem(lsKey(storeId, 'users')), []);
  const auditLogs = safeParse<AuditEntry[]>(localStorage.getItem(lsKey(storeId, 'auditLogs')), []);
  const settings = safeParse<BusinessSettings>(localStorage.getItem(lsKey(storeId, 'settings')), defaults.settings);

  await Promise.all([
    storeRepo.setCollection(storeId, 'products', products),
    storeRepo.setCollection(storeId, 'suppliers', suppliers),
    storeRepo.setCollection(storeId, 'sales', sales),
    storeRepo.setCollection(storeId, 'prospects', prospects),
    storeRepo.setCollection(storeId, 'users', users),
    storeRepo.setCollection(storeId, 'auditLogs', auditLogs),
    storeRepo.setSettings(storeId, settings)
  ]);

  localStorage.setItem(flagKey, 'done');
}


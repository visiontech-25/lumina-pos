
import { db } from './firebaseConfig';
import { storeRepo } from './storeRepo';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  writeBatch, 
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Robust Sync Engine: Handles Cloud + Local persistence with an Outbox pattern.
 * Uses Firebase Firestore for cloud storage.
 * Ensures "Double Backup" by writing to Local Cache first, then Queueing for Cloud.
 * 
 * Firebase Security:
 * - Data is protected by Firestore Security Rules (not API keys)
 * - Multi-tenant isolation via storeId in document paths
 * - Offline-first: Works without internet, syncs when online
 */

interface OutboxItem {
  id: string;
  storeId: string;
  collection: string;
  action: 'SET' | 'DELETE' | 'BULK_SET';
  payload: any;
  timestamp: string;
  retryCount: number;
}

const MAX_RETRIES = 3;

const outboxId = () => `SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

// Real Firebase Firestore Cloud Storage
const cloudAPI = {
  push: async (item: OutboxItem): Promise<boolean> => {
    if (!navigator.onLine) return false;

    try {
      // Firestore collection path: stores/{storeId}/{collection}/{docId}
      const collectionPath = `stores/${item.storeId}/${item.collection}`;
      const collectionRef = collection(db, collectionPath);

      if (item.action === 'SET') {
        // Set a single document
        const docRef = doc(collectionRef, item.payload.id);
        await setDoc(docRef, {
          ...item.payload,
          storeId: item.storeId,
          lastUpdated: serverTimestamp(),
          syncedAt: serverTimestamp()
        }, { merge: true });
        return true;

      } else if (item.action === 'DELETE') {
        // Delete a document
        const docRef = doc(collectionRef, item.payload);
        await deleteDoc(docRef);
        return true;

      } else if (item.action === 'BULK_SET') {
        // Batch write for multiple documents
        const batch = writeBatch(db);
        const itemsToWrite = Array.isArray(item.payload) ? item.payload : [item.payload];
        
        itemsToWrite.forEach((dataItem: any) => {
          const docRef = doc(collectionRef, dataItem.id);
          batch.set(
            docRef,
            {
              ...dataItem,
              storeId: item.storeId,
              lastUpdated: serverTimestamp(),
              syncedAt: serverTimestamp()
            },
            { merge: true }
          );
        });
        
        await batch.commit();
        return true;
      }

      return false;
    } catch (e) {
      console.error("Firebase Sync Error:", e);
      return false;
    }
  }
};

/**
 * Public Sync API
 */

export const syncToCloud = async (storeId: string, collection: string, data: any) => {
  // 1. Immediate Local Backup (Primary Storage)
  const localKey = `lumina_${storeId}_${collection}`;
  localStorage.setItem(localKey, JSON.stringify(data));

  // 2. Queue for Cloud Sync
  const current = await storeRepo.getOutbox(storeId);
  const next: OutboxItem[] = [
    ...current,
    {
      id: outboxId(),
      storeId,
      collection,
      action: Array.isArray(data) ? 'BULK_SET' : 'SET',
      payload: data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    }
  ];
  await storeRepo.setOutbox(storeId, next);

  // 3. Attempt to flush outbox immediately if online
  if (navigator.onLine) {
    flushSyncOutbox(storeId);
  }
};

export const flushSyncOutbox = async (storeId: string) => {
  if (!navigator.onLine) return;

  const items = await storeRepo.getOutbox(storeId);
  if (items.length === 0) return;

  // Process one by one to ensure ordering and handle failures gracefully
  for (const item of items) {
    // Skip items that have exceeded max retries
    if (item.retryCount >= MAX_RETRIES) {
      console.warn(`Skipping item ${item.id} - max retries exceeded`);
      const remaining = (await storeRepo.getOutbox(storeId)).filter(i => i.id !== item.id);
      await storeRepo.setOutbox(storeId, remaining);
      continue;
    }

    const success = await cloudAPI.push(item);
    if (success) {
      const remaining = (await storeRepo.getOutbox(storeId)).filter(i => i.id !== item.id);
      await storeRepo.setOutbox(storeId, remaining);
    } else {
      // Increment retry count and keep in queue
      const cur = await storeRepo.getOutbox(storeId);
      const bumped = cur.map(x => (x.id === item.id ? { ...x, retryCount: x.retryCount + 1 } : x));
      await storeRepo.setOutbox(storeId, bumped);
      // If one fails, stop processing to preserve order for this tenant
      break;
    }
  }
};

export const getPendingSyncCount = (storeId: string): number => {
  // Synchronous count for UI badges. Keep LocalStorage mirrored via storeRepo.setOutbox().
  try {
    const raw = localStorage.getItem(`lumina_${storeId}_sync_outbox`) || '[]';
    return JSON.parse(raw).length || 0;
  } catch {
    return 0;
  }
};

export const getDeveloperHealthStream = () => {
  return JSON.parse(localStorage.getItem('dev_telemetry_stream') || '[]');
};

// Export Firestore db instance for direct use in components
// This is the real Firebase Firestore instance
export { db };

export const createNewStore = async (storeName: string, ownerEmail: string, ownerUid: string) => {
  const storeId = `STR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const storeMeta = { 
    id: storeId, 
    name: storeName, 
    ownerEmail, 
    ownerUid,
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp()
  };
  
  // Save to Firebase
  try {
    const storeRef = doc(db, 'stores', storeId);
    await setDoc(storeRef, storeMeta);
  } catch (e) {
    console.error("Error creating store in Firebase:", e);
    throw e;
  }
  
  // Also save locally
  const stores = JSON.parse(localStorage.getItem('global_stores_registry') || '[]');
  stores.push(storeMeta);
  localStorage.setItem('global_stores_registry', JSON.stringify(stores));
  
  return storeId;
};

/**
 * Central receipt counter per store (server-side transaction).
 * Guarantees gap-free, strictly increasing numbers across terminals when online.
 */
export const getNextReceiptNumber = async (storeId: string, prefix: string): Promise<string> => {
  try {
    const counterRef = doc(db, 'stores', storeId, 'meta', 'receiptCounter');
    const seq = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? (snap.data().seq as number) || 0 : 0;
      const next = current + 1;
      tx.set(counterRef, { seq: next, updatedAt: serverTimestamp() }, { merge: true });
      return next;
    });
    const safePrefix = (prefix || 'LUM').trim() || 'LUM';
    return `${safePrefix}-${String(seq).padStart(6, '0')}`;
  } catch {
    // Fallback to client-side sequence if offline or transaction fails.
    const safePrefix = (prefix || 'LUM').trim() || 'LUM';
    const key = `lumina_${storeId}_receipt_seq`;
    const seq = Number(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, String(seq));
    return `${safePrefix}-${String(seq).padStart(6, '0')}`;
  }
};

export const saveToCloud = async (storeId: string, collectionName: string, data: any) => {
  await syncToCloud(storeId, collectionName, data);
};

/**
 * Transactional checkout: atomically decrements product stock and creates sale.
 * Prevents overselling by validating stock >= quantity for each item.
 * Use when online; falls back to caller's optimistic flow when offline.
 */
export interface CheckoutTransactionResult {
  success: boolean;
  error?: string;
  insufficientStock?: { productId: string; productName: string; available: number; requested: number };
}

export const runCheckoutTransaction = async (
  storeId: string,
  cartItems: Array<{ id: string; name: string; sku: string; price: number; quantity: number }>,
  saleRecord: { id: string; timestamp: string; items: any[]; subtotal: number; tax: number; total: number; paymentMethod: string; receiptNumber?: string; discountAmount?: number; customerId?: string; customerName?: string; customerEmail?: string; mpesaReceipt?: string }
): Promise<CheckoutTransactionResult> => {
  if (!navigator.onLine) {
    return { success: false, error: 'Offline. Checkout will sync when online.' };
  }

  try {
    await runTransaction(db, async (tx) => {
      // 1. Read current stock for each product and validate
      const productRefs = cartItems.map((item) => doc(db, 'stores', storeId, 'products', item.id));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const snap = productSnaps[i];
        if (!snap.exists()) {
          throw new Error(`Product ${item.name} (${item.id}) not found in Firestore. Sync products first.`);
        }
        const data = snap.data();
        const currentStock = (data?.stock ?? 0) as number;
        if (currentStock < item.quantity) {
          throw { type: 'INSUFFICIENT_STOCK', productId: item.id, productName: item.name, available: currentStock, requested: item.quantity };
        }
      }

      // 2. Decrement stock for each product
      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const ref = productRefs[i];
        const snap = productSnaps[i];
        const data = snap.data()!;
        const newStock = (data.stock ?? 0) - item.quantity;
        tx.update(ref, { stock: Math.max(0, newStock), lastUpdated: serverTimestamp() });
      }

      // 3. Create sale document
      const saleRef = doc(db, 'stores', storeId, 'sales', saleRecord.id);
      tx.set(saleRef, {
        ...saleRecord,
        storeId,
        status: 'completed',
        lastUpdated: serverTimestamp(),
        syncedAt: serverTimestamp()
      });
    });
    return { success: true };
  } catch (err: any) {
    if (err?.type === 'INSUFFICIENT_STOCK') {
      return {
        success: false,
        insufficientStock: {
          productId: err.productId,
          productName: err.productName,
          available: err.available,
          requested: err.requested
        }
      };
    }
    return {
      success: false,
      error: err?.message || 'Checkout transaction failed.'
    };
  }
};

export const deleteFromCloud = async (storeId: string, collectionName: string, id: string) => {
  const current = await storeRepo.getOutbox(storeId);
  const next: OutboxItem[] = [
    ...current,
    {
      id: outboxId(),
      storeId,
      collection: collectionName,
      action: 'DELETE',
      payload: id,
      timestamp: new Date().toISOString(),
      retryCount: 0
    }
  ];
  await storeRepo.setOutbox(storeId, next);
  if (navigator.onLine) flushSyncOutbox(storeId);
};

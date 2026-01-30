import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Suppliers from './components/Suppliers';
import SalesHistory from './components/SalesHistory';
import Reports from './components/Reports';
import Prospects from './components/Prospects';
import Settings from './components/Settings';
import AuditLog from './components/AuditLog';
import UserManual from './components/UserManual';
import Customers from './components/Customers';
import RefundModal from './components/RefundModal';
import Restaurant from './components/Restaurant';
import KDS from './components/KDS';
import OnlineOrders from './components/OnlineOrders';
import Analytics from './components/Analytics';
import Auth from './components/Auth';
import ManagerPasswordModal from './components/ManagerPinModal';
import LuminaAIAssistant from './components/LuminaAIAssistant';
import { AppTab, Product, Sale, Prospect, User, BusinessSettings, Supplier, AuditEntry, TelemetryData, StockHistoryEntry, Customer, LoyaltyAccount, RestaurantSection, RestaurantTable, RestaurantOrder } from './types';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from './constants';
import { syncToCloud, flushSyncOutbox, getPendingSyncCount, getNextReceiptNumber, runCheckoutTransaction } from './services/firebaseService';
import { nativeService } from './services/nativeService';
import { WifiOff, RefreshCw, Sparkles, ShoppingCart, Package, History, BarChart3, Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { storeRepo } from './services/storeRepo';
import { fiscalLedger } from './services/fiscalLedger';
import { deriveStateFromEvents } from './services/ledgerDerivation';
import { priceCart } from './services/pricingService';
import { runStoreMigrationIfNeeded } from './services/migrationService';
import { hardwareService } from './services/hardwareService';

const DEFAULT_SETTINGS: BusinessSettings = {
  storeName: 'Lumina Store',
  email: 'contact@lumina-pos.com',
  location: '123 Retail Plaza, Suite 400, Commerce City, 90210',
  phone: '+1 (555) 123-4567',
  refundPolicy: 'Goods sold are final.',
  currencyCode: 'USD',
  currencySymbol: '$',
  businessMode: 'retail',
  receiptPrefix: 'LUM',
  receiptOptions: {
    autoOpen: true,
    autoShare: false,
    autoDownload: false,
  },
  theme: 'dark'
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.POS);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pinChallenge, setPinChallenge] = useState<{ active: boolean; title: string; description: string; onResolve: () => void } | null>(null);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [trustedDevice, setTrustedDevice] = useState<boolean>(() => {
    return localStorage.getItem('lumina_trusted_device') === 'yes';
  });
  const [promotions, setPromotions] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [refundContext, setRefundContext] = useState<Sale | null>(null);
  const [restaurantSections, setRestaurantSections] = useState<RestaurantSection[]>([]);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([]);
  const [restaurantOrders, setRestaurantOrders] = useState<RestaurantOrder[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [kdsStation, setKdsStation] = useState<'kitchen' | 'bar' | 'dessert' | 'cold'>('kitchen');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Sync Outbox Listener + Offline-First: push pending data the moment connection is restored
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user?.storeId) {
        flushSyncOutbox(user.storeId).then(() => setPendingSyncs(getPendingSyncCount(user.storeId)));
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const syncInterval = setInterval(async () => {
      const storeId = user?.storeId;
      const count = storeId ? getPendingSyncCount(storeId) : 0;
      setPendingSyncs(count);
      
      if (storeId && count > 0 && navigator.onLine && !isSyncing) {
        setIsSyncing(true);
        await flushSyncOutbox(storeId);
        setIsSyncing(false);
        setPendingSyncs(getPendingSyncCount(storeId));
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [isSyncing, user?.storeId]);

  /**
   * Native Device Integration
   * Handle Android Back Button to navigate tabs or close overlays
   */
  useEffect(() => {
    let backButtonListener: any = null;

    const setupListeners = async () => {
      backButtonListener = await nativeService.app.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
        if (isTerminalLocked || pinChallenge) return; // Prevent navigation when locked
        
        // If we aren't in the POS tab, go back to POS
        if (activeTab !== AppTab.POS) {
          setActiveTab(AppTab.POS);
        } else if (!canGoBack) {
          // If we are at root and can't go back further, maybe show a toast
          nativeService.toast("Press again to exit");
        }
      });
    };

    setupListeners();

    return () => {
      if (backButtonListener) backButtonListener.remove();
    };
  }, [activeTab, isTerminalLocked, pinChallenge]);

  // Basic session hygiene: auto-lock after 10 minutes of inactivity (shorter if not trusted).
  useEffect(() => {
    if (!user) return;
    const timeoutMs = trustedDevice ? 30 * 60 * 1000 : 10 * 60 * 1000;
    let timer: number;

    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setIsTerminalLocked(true);
      }, timeoutMs);
    };

    resetTimer();
    window.addEventListener('click', resetTimer);
    window.addEventListener('keydown', resetTimer);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [user, trustedDevice]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (businessSettings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [businessSettings.theme]);

  useEffect(() => {
    const savedUser = localStorage.getItem('lumina_current_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      loadStoreData(u.storeId);
    }
    setIsAuthLoading(false);
  }, []);

  const loadStoreData = async (storeId: string) => {
    // Background migration: ensure legacy LocalStorage is mirrored into IndexedDB
    await runStoreMigrationIfNeeded(storeId, {
      products: INITIAL_PRODUCTS.map(p => ({ ...p, storeId, stockHistory: [] })),
      suppliers: INITIAL_SUPPLIERS.map(s => ({ ...s, storeId })),
      settings: DEFAULT_SETTINGS
    });

    // Collections (base snapshots)
    const baseProducts = (await storeRepo.getCollection(
      storeId,
      'products',
      INITIAL_PRODUCTS.map(p => ({ ...p, storeId, stockHistory: [] }))
    )) as Product[];
    setSuppliers(
      (await storeRepo.getCollection(
        storeId,
        'suppliers',
        INITIAL_SUPPLIERS.map(s => ({ ...s, storeId }))
      )) as Supplier[]
    );
    const baseSales = (await storeRepo.getCollection(storeId, 'sales', [])) as Sale[];
    setUsers((await storeRepo.getCollection(storeId, 'users', [])) as User[]);
    setProspects((await storeRepo.getCollection(storeId, 'prospects', [])) as Prospect[]);
    setAuditLogs((await storeRepo.getCollection(storeId, 'auditLogs', [])) as AuditEntry[]);
    setCustomers(await storeRepo.getCustomers(storeId));
    setLoyaltyAccounts(await storeRepo.getLoyaltyAccounts(storeId));
    setPromotions(await storeRepo.getPromotions(storeId));
    setPriceLists(await storeRepo.getPriceLists(storeId));
    setRestaurantSections(await storeRepo.getRestaurantSections(storeId));
    setRestaurantTables(await storeRepo.getRestaurantTables(storeId));
    setRestaurantOrders(await storeRepo.getRestaurantOrders(storeId));

    // Optional: derive products + sales from immutable ledger when events exist.
    const derived = await deriveStateFromEvents(storeId, baseProducts);
    setProducts(derived.products);
    setSales(derived.sales.length > 0 ? derived.sales : baseSales);

    // Settings
    const settings = await storeRepo.getSettings(storeId, DEFAULT_SETTINGS);
    setBusinessSettings(settings);
    hardwareService.configure(settings.hardware);

    // Sync status badge
    setPendingSyncs(getPendingSyncCount(storeId));
  };

  const handleUpdateProducts = (newProducts: Product[]) => {
    setProducts(newProducts);
    if (user) {
      // Persist to IndexedDB (primary) then queue for cloud sync
      storeRepo.setCollection(user.storeId, 'products', newProducts);
      syncToCloud(user.storeId, 'products', newProducts);
    }
  };

  const handleUpdateSales = (newSales: Sale[]) => {
    setSales(newSales);
    if (user) {
      storeRepo.setCollection(user.storeId, 'sales', newSales);
      syncToCloud(user.storeId, 'sales', newSales);
    }
    nativeService.haptics.notification('SUCCESS');
  };

  const nextReceiptNumber = (storeId: string) => {
    // Uses central Firestore transaction when online, falls back to local sequence.
    const prefix = businessSettings.receiptPrefix || 'LUM';
    // Fire-and-forget async; optimistic local placeholder will be overwritten by real receiptNumber.
    getNextReceiptNumber(storeId, prefix).then(real => {
      localStorage.setItem(`lumina_${storeId}_last_receipt`, real);
    }).catch(() => {});

    const fallback = localStorage.getItem(`lumina_${storeId}_last_receipt`);
    return fallback || `${(prefix || 'LUM').trim() || 'LUM'}-${String(Date.now()).slice(-6)}`;
  };

  const handleUpdateProspects = (newProspects: Prospect[]) => {
    setProspects(newProspects);
    if (user) {
      storeRepo.setCollection(user.storeId, 'prospects', newProspects);
      syncToCloud(user.storeId, 'prospects', newProspects);
    }
  };

  const handleUpdateSettings = (newSettings: BusinessSettings) => {
    setBusinessSettings(newSettings);
    if (user) {
      storeRepo.setSettings(user.storeId, newSettings);
      syncToCloud(user.storeId, 'settings', newSettings);
    }
    hardwareService.configure(newSettings.hardware);
  };

  const handleUpdateUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    if (user) {
      storeRepo.setCollection(user.storeId, 'users', newUsers);
      syncToCloud(user.storeId, 'users', newUsers);
    }
  };



  const handleSignUp = (newUser: User) => {
    const currentUsers = JSON.parse(localStorage.getItem('global_users_registry') || '[]');
    currentUsers.push(newUser);
    localStorage.setItem('global_users_registry', JSON.stringify(currentUsers));
    setUser(newUser);
    localStorage.setItem('lumina_current_user', JSON.stringify(newUser));
    loadStoreData(newUser.storeId);
    nativeService.toast(`Welcome to ${newUser.storeId}`);
  };

  const handleLogin = (foundUser: User) => {
    setUser(foundUser);
    localStorage.setItem('lumina_current_user', JSON.stringify(foundUser));
    loadStoreData(foundUser.storeId);
    nativeService.haptics.impact('LIGHT');
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: businessSettings.currencyCode || 'USD'
    }).format(amt);
  };

  const handleAdminAction = (title: string, description: string, onConfirm: () => void) => {
    setPinChallenge({
      active: true,
      title: title,
      description: description,
      onResolve: onConfirm
    });
  };

  const addAuditLog = (action: string, details: string, severity: AuditEntry['severity'] = 'low') => {
    if (!user) return;
    const log: AuditEntry = {
      id: `LOG-${Date.now()}`,
      storeId: user.storeId,
      timestamp: new Date().toISOString(),
      userName: user.name,
      action,
      details,
      severity
    };
    const newLogs = [log, ...auditLogs];
    setAuditLogs(newLogs);
    syncToCloud(user.storeId, 'auditLogs', newLogs);
  };

  if (isAuthLoading) return null;
  if (!user) return <Auth users={JSON.parse(localStorage.getItem('global_users_registry') || '[]')} onLogin={handleLogin} onSignUp={handleSignUp} />;

  return (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-slate-900 overflow-hidden font-sans antialiased text-gray-900 dark:text-gray-200 relative">
      {isSidebarOpen && (
        <Sidebar 
          user={user} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={() => { setUser(null); localStorage.removeItem('lumina_current_user'); }} 
          onLock={() => { setIsTerminalLocked(true); nativeService.haptics.impact('MEDIUM'); }} 
          businessMode={businessSettings.businessMode || 'retail'}
        />
      )}
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <div className="bg-white px-4 sm:px-8 py-4 border-b flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-indigo-600">
              {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
             <span className="text-slate-300">/</span>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{activeTab}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Lumina AI Assistant Button */}
            <button
              onClick={() => {
                setIsAIAssistantOpen(true);
                nativeService.haptics.impact('LIGHT');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
              title="Open Lumina AI Assistant"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold hidden sm:inline">Lumina AI</span>
            </button>

            {/* Real-time Sync Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 ${
              !isOnline ? 'bg-orange-50 border-orange-200 text-orange-600' :
              pendingSyncs > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-600' :
              'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : !isOnline ? (
                <WifiOff className="w-3.5 h-3.5" />
              ) : pendingSyncs > 0 ? (
                <RefreshCw className="w-3.5 h-3.5" />
              ) : (
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              )}
              <span className="text-[9px] font-black uppercase tracking-widest">
                {!isOnline ? `Offline (${pendingSyncs} Pending)` :
                 isSyncing ? 'Syncing Cloud...' :
                 pendingSyncs > 0 ? `${pendingSyncs} Changes Pending` :
                 'Cloud Synchronized'}
              </span>
            </div>

             <span className="text-xs font-bold text-slate-400 hidden sm:block">{user.name} @ {user.storeId}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === AppTab.POS && (
            businessSettings.businessMode === 'restaurant' && !selectedTableId ? (
              <Restaurant
                storeId={user.storeId}
                sections={restaurantSections}
                tables={restaurantTables}
                orders={restaurantOrders}
                products={products}
                onSaveSections={async (sections) => {
                  setRestaurantSections(sections);
                  await storeRepo.setRestaurantSections(user.storeId, sections);
                  syncToCloud(user.storeId, 'restaurantSections', sections);
                }}
                onSaveTables={async (tables) => {
                  setRestaurantTables(tables);
                  await storeRepo.setRestaurantTables(user.storeId, tables);
                  syncToCloud(user.storeId, 'restaurantTables', tables);
                }}
                onSaveOrders={async (orders) => {
                  setRestaurantOrders(orders);
                  await storeRepo.setRestaurantOrders(user.storeId, orders);
                  syncToCloud(user.storeId, 'restaurantOrders', orders);
                }}
                onSelectTable={setSelectedTableId}
                onConvertOrderToSale={async (order) => {
                  const receiptNumber = nextReceiptNumber(user.storeId);
                  const sale: Sale = {
                    id: `SALE-${Date.now()}`,
                    storeId: user.storeId,
                    timestamp: order.paidAt || new Date().toISOString(),
                    items: order.items,
                    subtotal: order.subtotal,
                    tax: order.tax,
                    total: order.total,
                    paymentMethod: order.paymentMethod || 'cash',
                    receiptNumber,
                    status: 'completed',
                    notes: `Table ${restaurantTables.find(t => t.id === order.tableId)?.number || '?'}` 
                  };
                  handleUpdateSales([sale, ...sales]);
                  await fiscalLedger.recordSaleCompleted(sale, user);
                  addAuditLog('RESTAURANT_ORDER_PAID', `Order ${order.id} converted to sale ${receiptNumber}`);
                }}
                formatCurrency={formatCurrency}
              />
            ) : (
              <POS 
                products={products}
                customers={customers.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, preferences: c.preferences }))}
                sales={sales}
                onCheckoutError={(msg) => nativeService.toast(msg)}
                onCompleteSale={async s => {
                  if (businessSettings.businessMode === 'restaurant' && selectedTableId) {
                    // In restaurant mode, create an order instead of immediate sale
                    const order: RestaurantOrder = {
                      id: `ORD-${Date.now()}`,
                      storeId: user.storeId,
                      tableId: selectedTableId,
                      state: 'draft',
                      items: s.items,
                      subtotal: s.subtotal,
                      tax: s.tax,
                      total: s.total,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      serverId: user.id
                    };
                    const newOrders = [...restaurantOrders, order];
                    setRestaurantOrders(newOrders);
                    await storeRepo.setRestaurantOrders(user.storeId, newOrders);
                    syncToCloud(user.storeId, 'restaurantOrders', newOrders);
                    nativeService.toast(`Order created for table ${restaurantTables.find(t => t.id === selectedTableId)?.number}`);
                    setSelectedTableId(null);
                  } else {
                    // Retail mode: normal sale with transaction integrity when online
                    const receiptNumber = nextReceiptNumber(user.storeId);
                    const completed: Sale = {
                      ...s,
                      storeId: user.storeId,
                      receiptNumber,
                      status: 'completed'
                    };
                    if (navigator.onLine) {
                      const txResult = await runCheckoutTransaction(
                        user.storeId,
                        s.items.map(i => ({ id: i.id, name: i.name, sku: i.sku, price: i.price, quantity: i.quantity })),
                        { ...completed, timestamp: completed.timestamp }
                      );
                      if (!txResult.success) {
                        if (txResult.insufficientStock) {
                          const msg = `${txResult.insufficientStock.productName}: only ${txResult.insufficientStock.available} in stock (requested ${txResult.insufficientStock.requested})`;
                          nativeService.toast(msg);
                          throw new Error(msg);
                        }
                        if (txResult.error?.includes('not found') || txResult.error?.includes('Sync')) {
                          console.warn('Firestore transaction skipped (products not synced), using local update:', txResult.error);
                        } else {
                          nativeService.toast(txResult.error || 'Checkout failed.');
                          throw new Error(txResult.error || 'Checkout failed.');
                        }
                      }
                    }
                    handleUpdateSales([completed, ...sales]);
                    await fiscalLedger.recordSaleCompleted(completed, user);
                    addAuditLog('SALE_COMPLETE', `Sale ${completed.id} (${receiptNumber}) completed by ${user.name}`);
                  }
                }} 
                promotions={promotions}
                priceLists={priceLists}
                channel={businessSettings.businessMode === 'restaurant' ? 'restaurant' : 'retail'}
                tableId={selectedTableId || undefined}
                onCancelTable={selectedTableId ? () => setSelectedTableId(null) : undefined}
                updateProductStock={(id, q) => {
                  const updatedProducts = products.map(p => {
                    if (p.id === id) {
                      const previousStock = p.stock;
                      const newStock = Math.max(0, previousStock + q);
                      const historyEntry: StockHistoryEntry = {
                        id: `STK-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        change: q,
                        previousStock: previousStock,
                        newStock: newStock,
                        reason: q < 0 ? 'Terminal Sale' : 'Inventory Restock',
                        performedBy: user.name
                      };
                      const updated = { ...p, stock: newStock, stockHistory: [...(p.stockHistory || []), historyEntry] };
                      fiscalLedger.recordStockAdjustment({
                        storeId: user.storeId,
                        user,
                        productId: p.id,
                        change: q,
                        previousStock,
                        newStock,
                        reason: historyEntry.reason
                      });
                      return updated;
                    }
                    return p;
                  });
                  handleUpdateProducts(updatedProducts);
                }} 
                formatCurrency={formatCurrency}
                receiptOptions={{
                  autoOpen: businessSettings.receiptOptions?.autoOpen ?? true,
                  autoShare: businessSettings.receiptOptions?.autoShare ?? false,
                  autoDownload: businessSettings.receiptOptions?.autoDownload ?? false,
                }}
              />
            )
          )}
          {activeTab === AppTab.RESTAURANT && (
            <Restaurant
              storeId={user.storeId}
              sections={restaurantSections}
              tables={restaurantTables}
              orders={restaurantOrders}
              products={products}
              onSaveSections={async (sections) => {
                setRestaurantSections(sections);
                await storeRepo.setRestaurantSections(user.storeId, sections);
                syncToCloud(user.storeId, 'restaurantSections', sections);
              }}
              onSaveTables={async (tables) => {
                setRestaurantTables(tables);
                await storeRepo.setRestaurantTables(user.storeId, tables);
                syncToCloud(user.storeId, 'restaurantTables', tables);
              }}
              onSaveOrders={async (orders) => {
                setRestaurantOrders(orders);
                await storeRepo.setRestaurantOrders(user.storeId, orders);
                syncToCloud(user.storeId, 'restaurantOrders', orders);
              }}
              onSelectTable={(tableId) => {
                setSelectedTableId(tableId);
                setActiveTab(AppTab.POS);
              }}
              onConvertOrderToSale={async (order) => {
                const receiptNumber = nextReceiptNumber(user.storeId);
                const sale: Sale = {
                  id: `SALE-${Date.now()}`,
                  storeId: user.storeId,
                  timestamp: order.paidAt || new Date().toISOString(),
                  items: order.items,
                  subtotal: order.subtotal,
                  tax: order.tax,
                  total: order.total,
                  paymentMethod: order.paymentMethod || 'cash',
                  receiptNumber,
                  status: 'completed',
                  notes: `Table ${restaurantTables.find(t => t.id === order.tableId)?.number || '?'}` 
                };
                handleUpdateSales([sale, ...sales]);
                await fiscalLedger.recordSaleCompleted(sale, user);
                addAuditLog('RESTAURANT_ORDER_PAID', `Order ${order.id} converted to sale ${receiptNumber}`);
              }}
              formatCurrency={formatCurrency}
            />
          )}
          {activeTab === AppTab.KDS && (
            <KDS
              orders={restaurantOrders}
              tables={restaurantTables}
              station={kdsStation}
              onUpdateOrders={async (next) => {
                setRestaurantOrders(next);
                await storeRepo.setRestaurantOrders(user.storeId, next);
                syncToCloud(user.storeId, 'restaurantOrders', next);
              }}
            />
          )}
          {activeTab === AppTab.INVENTORY && (
            <Inventory 
              user={user} 
              products={products} 
              sales={sales}
              inventoryView={businessSettings.inventoryView || 'grid-medium'}
              onUpdateProduct={p => {
                const previous = products.find(x => x.id === p.id);
                const updatedProducts = products.map(x => x.id === p.id ? p : x);
                handleUpdateProducts(updatedProducts);
                if (previous && previous.stock !== p.stock) {
                  fiscalLedger.recordStockAdjustment({
                    storeId: user.storeId,
                    user,
                    productId: p.id,
                    change: p.stock - previous.stock,
                    previousStock: previous.stock,
                    newStock: p.stock,
                    reason: 'Manual Inventory Edit'
                  });
                }
                addAuditLog('INVENTORY_UPDATE', `Product ${p.name} updated`);
              }} 
              onDeleteProduct={id => {
                handleUpdateProducts(products.filter(x => x.id !== id));
                addAuditLog('INVENTORY_DELETE', `Product ${id} deleted`, 'medium');
              }} 
              onBulkUpdateProducts={updates => {
                const updatedProducts = products.map(p => {
                  const u = updates.find(x => x.id === p.id);
                  if (u && u.stock !== undefined) {
                    const previousStock = p.stock;
                    const newStock = u.stock;
                    const historyEntry: StockHistoryEntry = {
                      id: `STK-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      change: newStock - previousStock,
                      previousStock: previousStock,
                      newStock: newStock,
                      reason: 'Bulk Operation Update',
                      performedBy: user.name
                    };
                    const updated = { ...p, ...u, stockHistory: [...(p.stockHistory || []), historyEntry] };
                    fiscalLedger.recordStockAdjustment({
                      storeId: user.storeId,
                      user,
                      productId: p.id,
                      change: newStock - previousStock,
                      previousStock,
                      newStock,
                      reason: historyEntry.reason
                    });
                    return updated;
                  }
                  return u ? {...p, ...u} : p;
                });
                handleUpdateProducts(updatedProducts);
              }} 
              onBulkAddProducts={items => handleUpdateProducts([...products, ...items.map(i => ({...i, storeId: user.storeId, stockHistory: i.stockHistory || []}))])} 
              onAddProduct={p => handleUpdateProducts([{...p, storeId: user.storeId}, ...products])} 
              formatCurrency={formatCurrency} 
              onViewSupplier={() => setActiveTab(AppTab.SUPPLIERS)} 
            />
          )}
          {activeTab === AppTab.SUPPLIERS && (
            <Suppliers 
              suppliers={suppliers} 
              products={products} 
              sales={sales} 
              onAddSupplier={s => {
                const newSups = [{...s, storeId: user.storeId}, ...suppliers];
                setSuppliers(newSups);
                storeRepo.setCollection(user.storeId, 'suppliers', newSups);
                syncToCloud(user.storeId, 'suppliers', newSups);
              }} 
              onUpdateSupplier={s => {
                const newSups = suppliers.map(x => x.id === s.id ? s : x);
                setSuppliers(newSups);
                storeRepo.setCollection(user.storeId, 'suppliers', newSups);
                syncToCloud(user.storeId, 'suppliers', newSups);
              }} 
              onDeleteSupplier={id => {
                const newSups = suppliers.filter(x => x.id !== id);
                setSuppliers(newSups);
                storeRepo.setCollection(user.storeId, 'suppliers', newSups);
                syncToCloud(user.storeId, 'suppliers', newSups);
              }} 
              formatCurrency={formatCurrency} 
            />
          )}
          {activeTab === AppTab.SALES && (
            <SalesHistory 
              sales={sales} 
              formatCurrency={formatCurrency} 
              onRefundSale={(sale) => {
                // Enforce simple refund policy: only admins can refund and only within 24 hours.
                const saleAgeMs = Date.now() - new Date(sale.timestamp).getTime();
                const withinWindow = saleAgeMs <= 24 * 60 * 60 * 1000;
                if (user.role !== 'admin' || !withinWindow) {
                  nativeService.toast('Refund not allowed: requires admin and must be within 24 hours.');
                  return;
                }
                // Require manager PIN for refunds, then open granular refund modal
                setPinChallenge({
                  active: true,
                  title: 'Refund Authorization',
                  description: `Refund ${sale.receiptNumber || sale.id}. Select lines and quantities.`,
                  onResolve: () => {
                    setRefundContext(sale);
                  }
                });
              }}
            />
          )}
          {activeTab === AppTab.REPORTS && (
            <Reports 
              user={user} 
              telemetry={{ 
                sessions: 1, 
                tabUsage: {}, 
                totalSalesCompleted: sales.length, 
                totalProductsImported: products.length, 
                lastActive: new Date().toISOString(), 
                peakInventoryCount: products.length, 
                syncSuccessRate: 100 
              }} 
              sales={sales} 
              products={products} 
              formatCurrency={formatCurrency} 
              currencySymbol={businessSettings.currencySymbol} 
            />
          )}
          {activeTab === AppTab.ANALYTICS && (
            <Analytics
              user={user}
              sales={sales}
              products={products}
              formatCurrency={formatCurrency}
            />
          )}
          {activeTab === AppTab.ONLINE_ORDERS && (
            <OnlineOrders 
              user={user}
              sales={sales}
              onUpdateSale={(updatedSale) => {
                const newSales = sales.map(s => s.id === updatedSale.id ? updatedSale : s);
                handleUpdateSales(newSales);
              }}
              formatCurrency={formatCurrency}
            />
          )}
          {activeTab === AppTab.PROSPECTS && (
            <Prospects 
              user={user}
              products={products}
              prospects={prospects}
              onAddProspect={p => handleUpdateProspects([p, ...prospects])}
              onUpdateProspect={p => handleUpdateProspects(prospects.map(x => x.id === p.id ? p : x))}
              onCompleteSale={s => handleUpdateSales([s, ...sales])}
              updateProductStock={(id, q) => {
                const updatedProducts = products.map(p => {
                  if (p.id === id) {
                    const previousStock = p.stock;
                    const newStock = Math.max(0, previousStock + q);
                    const historyEntry: StockHistoryEntry = {
                      id: `STK-${Date.now()}`,
                      timestamp: new Date().toISOString(),
                      change: q,
                      previousStock: previousStock,
                      newStock: newStock,
                      reason: 'Conversion Sale',
                      performedBy: user.name
                    };
                    return { ...p, stock: newStock, stockHistory: [...(p.stockHistory || []), historyEntry] };
                  }
                  return p;
                });
                handleUpdateProducts(updatedProducts);
              }}
              formatCurrency={formatCurrency}
            />
          )}
          {activeTab === AppTab.CUSTOMERS && (
            <Customers
              customers={customers}
              loyaltyAccounts={loyaltyAccounts}
              sales={sales}
              onSaveCustomers={async list => {
                setCustomers(list);
                await storeRepo.setCustomers(user.storeId, list);
                syncToCloud(user.storeId, 'customers', list);
              }}
              onSaveLoyalty={async list => {
                setLoyaltyAccounts(list);
                await storeRepo.setLoyaltyAccounts(user.storeId, list);
                syncToCloud(user.storeId, 'loyalty', list);
              }}
            />
          )}
          {activeTab === AppTab.SETTINGS && (
            <Settings 
              settings={businessSettings}
              onUpdateSettings={handleUpdateSettings}
              users={users}
              onAddUser={u => {
                const newUsers = [...users, u];
                setUsers(newUsers);
                storeRepo.setCollection(user.storeId, 'users', newUsers);
                syncToCloud(user.storeId, 'users', newUsers);
              }}
              onDeleteUser={id => {
                const newUsers = users.filter(x => x.id !== id);
                setUsers(newUsers);
                storeRepo.setCollection(user.storeId, 'users', newUsers);
                syncToCloud(user.storeId, 'users', newUsers);
              }}
              onUpdateUser={u => {
                const newUsers = users.map(x => x.id === u.id ? u : x);
                handleUpdateUsers(newUsers);
              }}
              currentUser={user}
              onAdminAction={handleAdminAction}
            />
          )}
          {activeTab === AppTab.USER_MANUAL && <UserManual />}
          {activeTab === AppTab.SECURITY && (
            <AuditLog logs={auditLogs} />
          )}
        </div>
      </main>

      {isTerminalLocked && (
        <ManagerPasswordModal 
          managerPasswordHash={businessSettings.managerPasswordHash}
          actionDescription="Terminal Locked. Enter password to resume." 
          onCancel={() => {}} 
          onSuccess={() => setIsTerminalLocked(false)} 
        />
      )}

      {pinChallenge && pinChallenge.active && (
        <ManagerPasswordModal 
          managerPasswordHash={businessSettings.managerPasswordHash}
          actionDescription={pinChallenge.description}
          onSuccess={() => {
            addAuditLog('MANAGER_OVERRIDE', `${pinChallenge.title} approved by manager`);
            pinChallenge.onResolve();
            setPinChallenge(null);
          }}
          onCancel={() => setPinChallenge(null)}
        />
      )}

      {/* Lumina AI Assistant */}
      <LuminaAIAssistant 
        isOpen={isAIAssistantOpen} 
        onClose={() => setIsAIAssistantOpen(false)} 
      />

      {refundContext && (
        <RefundModal
          sale={refundContext}
          onCancel={() => setRefundContext(null)}
          onConfirm={async (lines) => {
            const reason = prompt('Enter refund reason (required)', 'Customer return/Exchange');
            if (!reason) {
              nativeService.toast('Refund cancelled: reason is required.');
              return;
            }

            // Update sale status
            const refunded: Sale = {
              ...refundContext,
              status: 'partially_refunded',
              refundedAt: new Date().toISOString()
            };
            const newSales = sales.map(x => x.id === refunded.id ? refunded : x);
            handleUpdateSales(newSales);

            // Apply stock changes per line
            const updatedProducts = products.map(p => {
              const plan = lines.find(l => l.productId === p.id);
              if (!plan || plan.qty <= 0) return p;
              const previousStock = p.stock;
              const change = plan.writeOff ? 0 : plan.qty;
              const newStock = previousStock + change;
              const historyEntry: StockHistoryEntry = {
                id: `STK-${Date.now()}`,
                timestamp: new Date().toISOString(),
                change,
                previousStock,
                newStock,
                reason: plan.writeOff ? 'Refund Write-off' : 'Refund Restock',
                performedBy: user.name
              };
              const updated = {
                ...p,
                stock: newStock,
                stockHistory: [...(p.stockHistory || []), historyEntry]
              };
              fiscalLedger.recordStockAdjustment({
                storeId: user.storeId,
                user,
                productId: p.id,
                change,
                previousStock,
                newStock,
                reason: historyEntry.reason
              });
              return updated;
            });
            handleUpdateProducts(updatedProducts);

            // Immutable refund event with per-line quantities
            await fiscalLedger.recordSaleRefunded(
              {
                ...refunded,
                items: refunded.items.map(i => {
                  const plan = lines.find(l => l.productId === i.id);
                  return plan ? { ...i, quantity: plan.qty } : i;
                })
              },
              user,
              {
                reason,
                writeOffType: lines.some(l => l.writeOff) ? 'WRITE_OFF' : 'RETURN_TO_STOCK'
              }
            );
            addAuditLog('SALE_REFUND', `Partial refund on ${refunded.id} by ${user.name}`, 'high');
            setRefundContext(null);
          }}
        />
      )}
    </div>
  );

};

export default App;

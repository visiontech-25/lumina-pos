
export interface UserPermissions {
  canManageInventory: boolean;
  canViewReports: boolean;
  canManageProspects: boolean;
  canManageSettings: boolean;
}

export interface User {
  id: string;
  storeId: string; // Multi-tenant identifier
  name: string;
  email: string;
  // Legacy (will be migrated to passwordHash)
  password?: string;
  // Preferred secure storage (hash, not plaintext)
  passwordHash?: string;
  pin: string;
  role: 'admin' | 'staff';
  permissions: UserPermissions;
  hasBiometrics?: boolean;
}

export interface Store {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
}

export interface BusinessSettings {
  managerPasswordHash?: string;
  storeName: string;
  email: string;
  location: string;
  phone: string;
  refundPolicy: string;
  currencyCode: string;
  currencySymbol: string;
  // Business configuration
  businessMode?: 'retail' | 'restaurant';
  // Added missing property for M-Pesa integration
  mpesaTillNumber?: string;
  // Receipt / printing behavior
  receiptPrefix?: string; // e.g. LUM
  receiptOptions?: { autoOpen: boolean; autoShare: boolean; autoDownload: boolean; };
  telemetryEnabled?: boolean;
  /**
   * Tax configuration
   * - If unset, falls back to legacy flat TAX_RATE constant.
   */
  taxConfig?: TaxConfig;
  /**
   * Hardware configuration (printers, cash drawer, scanners).
   * Configured by the user per terminal.
   */
  hardware?: HardwareConfig;
  theme?: 'light' | 'dark';
  inventoryView?: InventoryView;
}

export type PrinterConnectionType = 'system' | 'network' | 'bluetooth' | 'usb';

export interface HardwareConfig {
  receiptPrinter?: PrinterConfig;
  kitchenPrinter?: PrinterConfig;
  cashDrawer?: {
    mode: 'printer-pulse' | 'none';
    printerTarget?: 'receipt' | 'kitchen';
  };
  scanner?: {
    mode: 'keyboard' | 'native';
  };
  scale?: {
    mode: 'none' | 'native';
  };
}

export interface PrinterConfig {
  connectionType: PrinterConnectionType;
  /**
   * Network (most universal): TCP raw printing (9100 default).
   */
  ip?: string;
  port?: number;
  /**
   * Bluetooth Classic SPP (Android): device MAC.
   */
  bluetoothMac?: string;
  /**
   * USB (future): vendor/product IDs.
   */
  usbVendorId?: number;
  usbProductId?: number;
}

export interface TelemetryData {
  sessions: number;
  tabUsage: Record<string, number>;
  totalSalesCompleted: number;
  totalProductsImported: number;
  lastActive: string;
  peakInventoryCount: number;
  syncSuccessRate: number;
}

export interface StockHistoryEntry {
  id: string;
  timestamp: string;
  change: number;
  previousStock: number;
  newStock: number;
  reason: string;
  performedBy?: string;
}

/**
 * Purchase orders + goods receiving
 */
export interface PurchaseOrderLine {
  productId: string;
  orderedQty: number;
  unitCost: number;
  expectedDeliveryDate?: string;
}

export interface PurchaseOrder {
  id: string;
  storeId: string;
  supplierId: string;
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
  createdAt: string;
  expectedAt?: string;
  notes?: string;
  lines: PurchaseOrderLine[];
}

export interface GoodsReceiptLine {
  productId: string;
  receivedQty: number;
  unitCost: number;
}

export interface GoodsReceipt {
  id: string;
  storeId: string;
  supplierId: string;
  purchaseOrderId?: string;
  receivedAt: string;
  lines: GoodsReceiptLine[];
  receivedBy: string;
}

/**
 * Stock transfers between locations / stores
 */
export interface StockTransferLine {
  productId: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  fromStoreId: string;
  toStoreId: string;
  createdAt: string;
  status: 'initiated' | 'in_transit' | 'completed' | 'cancelled';
  lines: StockTransferLine[];
}

/**
 * Cycle counts / stocktakes
 */
export interface StockCountLine {
  productId: string;
  systemQty: number;
  countedQty: number;
}

export interface StockCountSession {
  id: string;
  storeId: string;
  startedAt: string;
  completedAt?: string;
  performedBy: string;
  lines: StockCountLine[];
}

/** Luxury retail segments for high-end POS */
export type InventoryView = 'grid-small' | 'grid-medium' | 'grid-large' | 'list' | 'table';

export type LuxuryCategory = 'Watches' | 'Jewelry' | 'Leather Goods' | 'Fashion' | 'Accessories' | 'Fragrance' | 'Home' | 'Other';

export interface Product {
  id: string; 
  storeId: string; // Tenant isolation
  name: string;
  category: string;
  /** Luxury segment for high-end retail (Watches, Jewelry, etc.) */
  luxuryCategory?: LuxuryCategory;
  price: number;
  stock: number;
  image: string;
  sku: string;
  barcode?: string;
  supplier?: string;
  tags?: string[];
  lastUpdated: string; // For sync resolution
  stockHistory?: StockHistoryEntry[];
  /** Safety stock: flag when below this level */
  minStockLevel?: number;
  /** High-end attributes for luxury retail */
  material?: string;
  brand?: string;
  designer?: string;
  seasonalTags?: string[];
  /**
   * Tax category reference for multi-rate VAT models.
   */
  taxCategoryId?: string;
}

export interface Sale {
  id: string;
  storeId: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'online' | 'quote' | 'mpesa';
  receiptNumber?: string;
  status?: 'completed' | 'refunded' | 'partially_refunded' | 'pending_pickup';
  orderType?: 'in-store' | 'pickup';
  refundedAt?: string;
  discountAmount?: number;
  /** Clienteling: link sale to customer for purchase history & personalization */
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  // Added missing properties for transaction details and policy enforcement
  mpesaReceipt?: string;
  notes?: string;
  terms?: string;
  /**
   * For partial refunds / exchanges:
   * - Tracks aggregate amounts that have been refunded so far.
   */
  refundedTotalAmount?: number;
}

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  category: string;
  address: string;
  tags?: string[];
}

// Added missing Prospect interface used in the pipeline view
export interface Prospect {
  id: string;
  storeId: string;
  name: string;
  email: string;
  phone: string;
  status: 'draft' | 'sent' | 'follow-up' | 'converted';
  items: CartItem[];
  notes?: string;
  terms?: string;
  total: number;
  createdAt: string;
}

// Added missing AuditEntry interface for security logging
export interface AuditEntry {
  id: string;
  storeId: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CartItem extends Product {
  quantity: number;
  /**
   * Restaurant metadata (optional)
   */
  modifiers?: string[]; // e.g. ["no onions", "extra cheese"]
  course?: 'starter' | 'main' | 'dessert' | 'drink';
  kitchenStation?: 'kitchen' | 'bar' | 'dessert' | 'cold' | 'none';
  kitchenStatus?: 'new' | 'sent' | 'preparing' | 'ready' | 'served';
}

/**
 * Promotions / price lists / time-based pricing
 */
export type PromotionType = 'PERCENT_OFF' | 'AMOUNT_OFF' | 'BOGO' | 'BUNDLE' | 'HAPPY_HOUR';

export interface Promotion {
  id: string;
  storeId: string;
  name: string;
  type: PromotionType;
  /**
   * Channel: e.g. 'retail' vs 'wholesale' vs 'online'
   */
  channel?: string;
  /**
   * Optional list of product IDs or tags this promo applies to.
   */
  productIds?: string[];
  tags?: string[];
  percentOff?: number;
  amountOff?: number;
  bogoBuyQty?: number;
  bogoGetQty?: number;
  bundleProductIds?: string[];
  /**
   * Time window controls
   */
  startAt?: string;
  endAt?: string;
  daysOfWeek?: number[]; // 0-6
  startTimeOfDay?: string; // "HH:MM"
  endTimeOfDay?: string; // "HH:MM"
  active: boolean;
}

export interface PriceListEntry {
  productId: string;
  price: number;
}

export interface PriceList {
  id: string;
  storeId: string;
  name: string;
  channel: string; // 'retail' | 'wholesale' | etc.
  entries: PriceListEntry[];
}

/**
 * Tax models
 */
export interface TaxRate {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  rate: number; // 0.16 => 16%
  countryCode?: string;
  isDefault?: boolean;
}

export interface TaxConfig {
  storeId: string;
  rates: TaxRate[];
  /**
   * If true, items without explicit taxCategoryId use default rate;
   * otherwise they are tax-exempt.
   */
  defaultAppliesToUntypedProducts?: boolean;
}

/**
 * Customers / loyalty / credit
 */
export interface Customer {
  id: string;
  storeId: string;
  name: string;
  email?: string;
  phone?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
  creditLimit?: number;
  currentCreditBalance?: number;
  /** Clienteling: preferences for luxury personalization */
  preferences?: string[];
  /** e.g. "Likes Purple", "Size M", "Prefers Leather" */
}

export interface LoyaltyAccount {
  id: string;
  storeId: string;
  customerId: string;
  points: number;
  tier?: string;
  lastActivityAt: string;
}

export interface CustomerHistorySummary {
  customerId: string;
  totalLifetimeValue: number;
  totalOrders: number;
  lastOrderAt?: string;
}

/**
 * Restaurant mode: tables, sections, order states
 */
export interface RestaurantSection {
  id: string;
  storeId: string;
  name: string;
  displayOrder: number;
}

export interface RestaurantTable {
  id: string;
  storeId: string;
  sectionId: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
}

export type RestaurantOrderState = 'draft' | 'sent' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export interface RestaurantOrder {
  id: string;
  storeId: string;
  tableId: string;
  state: RestaurantOrderState;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  tipAmount?: number;
  serviceChargeAmount?: number;
  splitCount?: number;
  paymentMethod?: Sale['paymentMethod'];
  createdAt: string;
  updatedAt: string;
  servedAt?: string;
  paidAt?: string;
  notes?: string;
  serverId?: string;
}

/**
 * Kitchen Display System (KDS)
 */
export type KitchenTicketStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface KitchenTicket {
  id: string;
  storeId: string;
  orderId: string;
  tableId: string;
  createdAt: string;
  updatedAt: string;
  status: KitchenTicketStatus;
  station: 'kitchen' | 'bar' | 'dessert' | 'cold';
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    modifiers?: string[];
    course?: CartItem['course'];
  }>;
  serverName?: string;
  notes?: string;
}

/**
 * Fiscal reports
 */
export interface FiscalReport {
  id: string;
  storeId: string;
  type: 'X_REPORT' | 'Z_REPORT' | 'END_OF_DAY' | 'PERIOD_CLOSING';
  startTime: string;
  endTime: string;
  totalSales: number;
  totalTax: number;
  totalRefunds: number;
  transactionCount: number;
  generatedBy: string;
  generatedAt: string;
}

/**
 * Multi-location support
 */
export interface StoreLocation {
  id: string;
  storeId: string;
  name: string;
  address?: string;
  isDefault: boolean;
}

/**
 * Label printing
 */
export interface LabelTemplate {
  id: string;
  storeId: string;
  name: string;
  type: 'SHELF_LABEL' | 'ITEM_LABEL' | 'BARCODE';
  width: number;
  height: number;
  content: string; // Template string
}

export enum AppTab {
  DASHBOARD = 'DASHBOARD',
  POS = 'POS',
  INVENTORY = 'INVENTORY',
  SUPPLIERS = 'SUPPLIERS',
  SALES = 'SALES',
  REPORTS = 'REPORTS',
  ANALYTICS = 'ANALYTICS',
  PROSPECTS = 'PROSPECTS',
  CUSTOMERS = 'CUSTOMERS',
  SETTINGS = 'SETTINGS',
  SECURITY = 'SECURITY',
  USER_MANUAL = 'USER_MANUAL',
  OPERATIONS = 'OPERATIONS',
  RESTAURANT = 'RESTAURANT',
  KDS = 'KDS',
  ONLINE_ORDERS = 'ONLINE_ORDERS'
}

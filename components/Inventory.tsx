
import React, { useState, useMemo, useRef } from 'react';
import { Product, User, StockHistoryEntry, LuxuryCategory, Sale, InventoryView } from '../types';
import { 
  Search, Plus, Edit2, Package2, X, Globe, Filter, XCircle, ChevronDown, 
  AlertCircle, CheckCircle2, PackageSearch, Bell, Tag, Hash, CheckSquare, 
  Square, ChevronRight, Truck, Layers, Trash2, Loader2, FileUp, Download, 
  AlertTriangle, FileCheck, Fingerprint, Eye, EyeOff, History, Minus, TrendingUp, TrendingDown, Clock, User as UserIcon, Printer
} from 'lucide-react';
import { printLabel } from '../services/labelPrinting';
import { nativeService } from '../services/nativeService';
import { getMarketIntelligence } from '../services/geminiService';
import MarketInsightModal from './MarketInsightModal';
import { slugify } from '../utils/stringUtils';
import aiService from '../services/aiService';

interface InventoryProps {
  user: User;
  products: Product[];
  sales: Sale[];
  inventoryView: InventoryView;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onBulkUpdateProducts: (updates: Partial<Product>[]) => void;
  onBulkAddProducts: (newItems: Product[]) => void;
  onAddProduct: (product: Product) => void;
  formatCurrency: (amount: number) => string;
  onViewSupplier: (supplierName: string) => void;
}

type StockStatus = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

const Inventory: React.FC<InventoryProps> = ({ 
  user, products, sales, inventoryView, onUpdateProduct, onDeleteProduct, onBulkUpdateProducts, 
  onBulkAddProducts, onAddProduct, formatCurrency, onViewSupplier
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [stockStatus, setStockStatus] = useState<StockStatus>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showInternalRef, setShowInternalRef] = useState(user.role === 'admin');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntry, setQuickEntry] = useState({ name: '', sku: '', price: '', stock: '' });
  
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);
  
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Manual Adjustment');
  
  const [csvPreview, setCsvPreview] = useState<{ products: Product[], errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const suppliers = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.supplier).filter(Boolean)))], [products]);
  
  const filtered = useMemo(() => {
    return products.filter(p => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(search) ||
                            p.id.toLowerCase().includes(search) ||
                            p.sku.toLowerCase().includes(search);
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSupplier = selectedSupplier === 'All' || p.supplier === selectedSupplier;
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => p.tags?.includes(tag));
      
      let matchesStock = true;
      if (stockStatus === 'in-stock') matchesStock = p.stock > 10;
      if (stockStatus === 'low-stock') matchesStock = p.stock > 0 && p.stock <= 10;
      if (stockStatus === 'out-of-stock') matchesStock = p.stock <= 0;

      return matchesSearch && matchesCategory && matchesSupplier && matchesStock && matchesTags;
    });
  }, [products, searchTerm, selectedCategory, selectedSupplier, stockStatus, selectedTags]);

  const LUXURY_CATEGORIES: LuxuryCategory[] = ['Watches', 'Jewelry', 'Leather Goods', 'Fashion', 'Accessories', 'Fragrance', 'Home', 'Other'];

  const CSV_TEMPLATE = [
    'name,sku,barcode,category,price,stock,supplier,tags',
    '"Swiss Watch","WCH-001","1234567890123","Watches",2999.99,5,"Luxury Time","premium;bestseller"',
    '"Leather Bag","BAG-002","","Leather Goods",899.00,12,"","handmade"'
  ].join('\n');

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { products: [], errors: ["Missing content."] };
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = values[i]?.replace(/"/g, '').trim() || ""; });
      return obj;
    });

    const valid: Product[] = [];
    const errs: string[] = [];
    rows.forEach((row, idx) => {
      const price = parseFloat(row.price);
      const stock = parseInt(row.stock);
      if (!row.name || isNaN(price) || isNaN(stock)) {
        errs.push(`Line ${idx+2}: Invalid data format.`);
      } else {
        const cat = row.category || row.luxurycategory || 'Uncategorized';
        const luxuryCat = LUXURY_CATEGORIES.includes(cat as LuxuryCategory) ? cat : undefined;
        valid.push({
          id: row.sku ? slugify(row.sku) : slugify(row.name),
          storeId: user.storeId,
          name: row.name,
          category: cat,
          luxuryCategory: luxuryCat,
          sku: row.sku || slugify(row.name).toUpperCase().slice(0, 20),
          barcode: row.barcode || undefined,
          price, 
          stock, 
          supplier: row.supplier || '',
          tags: row.tags ? row.tags.split(';').map((t:any) => t.trim().toLowerCase()) : [],
          image: 'https://images.unsplash.com/photo-1586769852044-692d6e3703a0?auto=format&fit=crop&q=80&w=200&h=200',
          lastUpdated: new Date().toISOString(),
          stockHistory: []
        });
      }
    });
    return { products: valid, errors: errs };
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const isNew = !products.some(p => p.id === editingProduct.id);
      const previousStock = isNew ? 0 : products.find(p => p.id === editingProduct.id)?.stock || 0;
      const newStock = Number(editingProduct.stock);
      
      const historyEntry: StockHistoryEntry = {
        id: `STK-${Date.now()}`,
        timestamp: new Date().toISOString(),
        change: newStock - previousStock,
        previousStock: previousStock,
        newStock: newStock,
        reason: isNew ? 'Initial Cataloging' : 'Manual Registry Update',
        performedBy: user.name
      };

      const id = isNew ? (editingProduct.sku ? slugify(editingProduct.sku) : slugify(editingProduct.name || '')) : editingProduct.id;
      const sku = editingProduct.sku?.trim() || slugify(editingProduct.name || '').toUpperCase().slice(0, 20);
      const prod = { 
        ...editingProduct, 
        id,
        sku,
        category: editingProduct.luxuryCategory || editingProduct.category || 'Other',
        price: Number(editingProduct.price), 
        stock: newStock,
        minStockLevel: editingProduct.minStockLevel,
        material: editingProduct.material,
        brand: editingProduct.brand,
        designer: editingProduct.designer,
        seasonalTags: editingProduct.seasonalTags,
        lastUpdated: new Date().toISOString(),
        storeId: user.storeId,
        image: editingProduct.image || 'https://images.unsplash.com/photo-1586769852044-692d6e3703a0?auto=format&fit=crop&q=80&w=200&h=200',
        stockHistory: [...(editingProduct.stockHistory || []), historyEntry]
      } as Product;

      isNew ? onAddProduct(prod) : onUpdateProduct(prod);
      setIsModalOpen(false);
    }
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustmentProduct) {
      const previousStock = adjustmentProduct.stock;
      const newStock = previousStock + adjustmentValue;
      
      const historyEntry: StockHistoryEntry = {
        id: `STK-${Date.now()}`,
        timestamp: new Date().toISOString(),
        change: adjustmentValue,
        previousStock: previousStock,
        newStock: newStock,
        reason: adjustmentReason,
        performedBy: user.name
      };

      const prod = {
        ...adjustmentProduct,
        stock: newStock,
        lastUpdated: new Date().toISOString(),
        stockHistory: [...(adjustmentProduct.stockHistory || []), historyEntry]
      };

      onUpdateProduct(prod);
      setIsAdjustmentModalOpen(false);
      setAdjustmentProduct(null);
      setAdjustmentValue(0);
      setAdjustmentReason('Manual Adjustment');
    }
  };

  return (
    <div className="relative min-h-full pb-24 lg:pb-8">
      <div className="p-4 lg:p-8 space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Inventory</h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">Internal stock identification hub</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
             {user.role === 'admin' && (
               <button onClick={() => setShowInternalRef(!showInternalRef)} className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-black hover:border-black transition-all">
                 {showInternalRef ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
               </button>
             )}
             <button onClick={() => setIsQuickEntryOpen(true)} className="flex-1 md:flex-none btn-positive bg-amber-600 text-white px-6 py-4 text-xs uppercase tracking-widest flex items-center justify-center gap-3">
               <Plus className="w-5 h-5" /> Quick Entry
             </button>
             <button onClick={() => setIsCsvModalOpen(true)} className="flex-1 md:flex-none btn-positive bg-emerald-600 text-white px-6 py-4 text-xs uppercase tracking-widest flex items-center justify-center gap-3">
               <FileUp className="w-5 h-5" /> Bulk Import
             </button>
             <button onClick={() => { setEditingProduct({ name: '', sku: '', price: 0, stock: 0, category: 'Other', luxuryCategory: 'Other', tags: [], stockHistory: [] }); setIsModalOpen(true); }} className="flex-1 md:flex-none btn-positive px-8 py-4 text-xs uppercase tracking-widest flex items-center justify-center gap-3">
               <Plus className="w-5 h-5" /> New Product
             </button>
          </div>
        </header>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Search product or reference..." className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-medium focus:ring-2 focus:ring-black outline-none transition-all text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="w-full pl-11 pr-10 py-4 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-black" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'All Segments' : cat}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <Package2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="w-full pl-11 pr-10 py-4 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-black" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                {suppliers.map(sup => <option key={sup} value={sup}>{sup === 'All' ? 'All Suppliers' : sup}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select className="w-full pl-11 pr-10 py-4 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-black" value={stockStatus} onChange={(e) => setStockStatus(e.target.value as StockStatus)}>
                <option value="all">Any Availability</option>
                <option value="in-stock">In Stock (&gt;10)</option>
                <option value="low-stock">Low Stock (1-10)</option>
                <option value="out-of-stock">Out of Stock (0)</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className={`
          ${inventoryView === 'table' || inventoryView === 'list' ? 'space-y-2' : ''}
          ${inventoryView.startsWith('grid') ? `grid gap-4 
            ${inventoryView === 'grid-small' ? 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8' : ''}
            ${inventoryView === 'grid-medium' ? 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6' : ''}
            ${inventoryView === 'grid-large' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : ''}
          ` : ''}
        `}>
          {inventoryView === 'table' && (
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-5 w-10">
                        <button onClick={() => selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(p => p.id)))} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                          {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                        </button>
                      </th>
                      <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">In Stock</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Unit Price</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ops</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(product => (
                      <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5"><button onClick={() => { const n = new Set(selectedIds); n.has(product.id) ? n.delete(product.id) : n.add(product.id); setSelectedIds(n); }} className="p-1 hover:bg-slate-200 rounded-lg transition-colors"><CheckSquare className={`w-4 h-4 ${selectedIds.has(product.id) ? 'text-indigo-600' : 'text-slate-400 opacity-50 group-hover:opacity-100'}`} /></button></td>
                        <td className="px-4 py-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-100 shadow-inner shrink-0"><img src={product.image} className="w-full h-full object-cover" alt="" /></div><div className="min-w-0"><span className="font-black text-slate-900 block truncate text-sm uppercase tracking-tight">{product.name}</span>{showInternalRef && (<div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-indigo-50 rounded text-[8px] font-mono font-bold text-indigo-400 tracking-tighter uppercase mt-1 w-fit"><Fingerprint className="w-2.5 h-2.5" /> {product.id}</div>)}</div></div></td>
                        <td className="px-8 py-5"><div className="space-y-1.5"><span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">{product.category}</span>{product.supplier && <button onClick={() => onViewSupplier(product.supplier!)} className="block text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-1"><Truck className="w-3 h-3" />{product.supplier}</button>}</div></td>
                        <td className="px-8 py-5 text-center"><button onClick={() => { setAdjustmentProduct(product); setIsAdjustmentModalOpen(true); }} className={`group/badge px-4 py-1.5 rounded-full text-xs font-black tracking-tight flex items-center justify-center gap-1.5 mx-auto w-fit transition-all hover:scale-105 active:scale-95 ${product.stock <= 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{product.stock}<Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/badge:opacity-100 transition-opacity" /></button></td>
                        <td className="px-8 py-5 text-right font-black text-slate-900 text-base">{formatCurrency(product.price)}</td>
                        <td className="px-8 py-5 text-right"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setHistoryProduct(product); setIsHistoryModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="View History"><History className="w-4 h-4" /></button><button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all" title="Edit Item"><Edit2 className="w-4 h-4" /></button><button onClick={() => confirm(`Are you sure you want to remove ${product.name}?`) && onDeleteProduct(product.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete Item"><Trash2 className="w-4 h-4" /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {inventoryView === 'list' && filtered.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center justify-between group">
              <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden"><img src={product.image} className="w-full h-full object-cover" /></div><div><p className="font-bold text-slate-800">{product.name}</p><p className="text-xs text-slate-400">{product.sku}</p></div></div>
              <div className="text-center"><p className="font-bold text-slate-800">{product.stock}</p><p className="text-xs text-slate-400">Stock</p></div>
              <div className="text-right"><p className="font-bold text-slate-800">{formatCurrency(product.price)}</p><p className="text-xs text-slate-400">Price</p></div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2 rounded-lg hover:bg-slate-100"><Edit2 className="w-4 h-4 text-slate-500"/></button><button onClick={() => onDeleteProduct(product.id)} className="p-2 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4 text-red-500"/></button></div>
            </div>
          ))}
          {inventoryView.startsWith('grid') && filtered.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col text-center group relative">
              <div className={`aspect-square w-full rounded-lg bg-slate-100 overflow-hidden mb-3 ${inventoryView === 'grid-small' ? 'h-20 mx-auto' : ''}`}><img src={product.image} className="w-full h-full object-cover" /></div>
              <p className={`font-bold text-slate-800 truncate ${inventoryView === 'grid-small' ? 'text-xs' : 'text-sm'}`}>{product.name}</p>
              <p className={`text-slate-400 ${inventoryView === 'grid-small' ? 'text-[10px]' : 'text-xs'}`}>{formatCurrency(product.price)}</p>
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }} className="p-2 rounded-lg bg-white/50 backdrop-blur-sm hover:bg-white"><Edit2 className="w-3 h-3 text-slate-600"/></button><button onClick={() => onDeleteProduct(product.id)} className="p-2 rounded-lg bg-white/50 backdrop-blur-sm hover:bg-red-100"><Trash2 className="w-3 h-3 text-red-500"/></button></div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Adjustment Modal */}
      {isAdjustmentModalOpen && adjustmentProduct && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAdjustmentModalOpen(false)} />
          <form onSubmit={handleStockAdjustment} className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 flex flex-col items-center animate-in zoom-in-95 duration-200 border border-slate-100">
             <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
               <PackageSearch className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Adjust Inventory</h3>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mb-8">{adjustmentProduct.name}</p>
             
             <div className="w-full flex items-center justify-center gap-6 mb-10">
               <button type="button" onClick={() => setAdjustmentValue(v => v - 1)} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all">
                 <Minus className="w-6 h-6 text-slate-600" />
               </button>
               <div className="flex flex-col items-center">
                 <span className={`text-4xl font-black ${adjustmentValue > 0 ? 'text-emerald-600' : adjustmentValue < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                   {adjustmentValue > 0 ? `+${adjustmentValue}` : adjustmentValue}
                 </span>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">New: {adjustmentProduct.stock + adjustmentValue}</span>
               </div>
               <button type="button" onClick={() => setAdjustmentValue(v => v + 1)} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center hover:bg-slate-100 active:scale-90 transition-all">
                 <Plus className="w-6 h-6 text-slate-600" />
               </button>
             </div>

             <div className="w-full space-y-2 mb-8">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Reason for adjustment</label>
               <select 
                 className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-[10px] uppercase tracking-widest outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-black"
                 value={adjustmentReason}
                 onChange={e => setAdjustmentReason(e.target.value)}
               >
                 <option value="Manual Adjustment">Manual Adjustment</option>
                 <option value="Supplier Restock">Supplier Restock</option>
                 <option value="Damaged Goods">Damaged Goods</option>
                 <option value="Stocktaking Correction">Stocktaking Correction</option>
                 <option value="Return to Inventory">Return to Inventory</option>
               </select>
             </div>

             <div className="flex gap-4 w-full">
               <button
                 type="button"
                 onClick={() => setIsAdjustmentModalOpen(false)}
                 className="flex-1 py-4 btn-negative text-[10px] uppercase tracking-widest"
               >
                 Cancel
               </button>
               <button
                 type="submit"
                 disabled={adjustmentValue === 0}
                 className="flex-[2] py-4 btn-positive text-[10px] uppercase tracking-widest disabled:opacity-30"
               >
                 Apply Changes
               </button>
             </div>
          </form>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && historyProduct && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300 border border-slate-100">
            <header className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Stock Registry Audit</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">{historyProduct.name}</p>
                </div>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              {(!historyProduct.stockHistory || historyProduct.stockHistory.length === 0) ? (
                <div className="py-24 flex flex-col items-center justify-center text-center opacity-30 gap-4">
                  <Clock className="w-12 h-12" />
                  <p className="text-xs font-black uppercase tracking-widest">No historical movement logged</p>
                </div>
              ) : (
                <div className="space-y-8 relative before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-slate-100 before:dashed">
                  {historyProduct.stockHistory.slice().reverse().map((entry, idx) => (
                    <div key={entry.id} className="relative pl-12 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                       <div className={`absolute left-0 w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${entry.change > 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                         {entry.change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                       </div>
                       
                       <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{entry.reason}</span>
                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 rounded text-slate-400 uppercase tracking-widest">{new Date(entry.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {entry.performedBy || 'System'}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                       </div>

                       <div className="flex items-center gap-8 shrink-0 text-right">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delta</span>
                            <span className={`text-sm font-black ${entry.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {entry.change > 0 ? `+${entry.change}` : entry.change}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Settled Stock</span>
                            <span className="text-sm font-black text-slate-900">{entry.newStock}</span>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <footer className="p-8 border-t bg-slate-50 flex justify-center">
               <button onClick={() => setIsHistoryModalOpen(false)} className="px-10 py-4 btn-negative text-[10px] uppercase tracking-widest">Close Audit</button>
            </footer>
          </div>
        </div>
      )}

      {/* Quick Entry Modal - high-efficiency retail onboarding */}
      {isQuickEntryOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsQuickEntryOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-slate-100">
            <header className="px-8 py-6 border-b flex justify-between items-center bg-amber-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Quick Entry</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fast product onboarding — minimal fields</p>
              </div>
              <button onClick={() => setIsQuickEntryOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </header>
            <form onSubmit={(e) => {
              e.preventDefault();
              const price = parseFloat(quickEntry.price);
              const stock = parseInt(quickEntry.stock);
              if (!quickEntry.name || isNaN(price) || isNaN(stock) || stock < 0) return;
              const prod: Product = {
                id: quickEntry.sku ? slugify(quickEntry.sku) : slugify(quickEntry.name),
                storeId: user.storeId,
                name: quickEntry.name,
                category: 'Other',
                sku: quickEntry.sku || slugify(quickEntry.name).toUpperCase().slice(0, 20),
                price,
                stock,
                image: 'https://images.unsplash.com/photo-1586769852044-692d6e3703a0?auto=format&fit=crop&q=80&w=200&h=200',
                lastUpdated: new Date().toISOString(),
                stockHistory: [{
                  id: `STK-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  change: stock,
                  previousStock: 0,
                  newStock: stock,
                  reason: 'Quick Entry',
                  performedBy: user.name
                }]
              };
              onAddProduct(prod);
              setQuickEntry({ name: '', sku: '', price: '', stock: '' });
            }} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 block mb-1">Name</label>
                  <input required placeholder="Product name" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold" value={quickEntry.name} onChange={e => setQuickEntry({...quickEntry, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 block mb-1">SKU</label>
                  <input placeholder="SKU (optional)" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold" value={quickEntry.sku} onChange={e => setQuickEntry({...quickEntry, sku: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 block mb-1">Price</label>
                  <input required type="number" step="0.01" min="0" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold" value={quickEntry.price} onChange={e => setQuickEntry({...quickEntry, price: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 block mb-1">Stock</label>
                  <input required type="number" min="0" placeholder="0" className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl font-bold" value={quickEntry.stock} onChange={e => setQuickEntry({...quickEntry, stock: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsQuickEntryOpen(false)} className="flex-1 py-3 btn-negative text-[10px] uppercase">Done</button>
                <button type="submit" className="flex-[2] py-3 btn-positive bg-amber-600 text-[10px] uppercase">Add & Add Another</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCsvModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsCsvModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-slate-100">
            <header className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Bulk Catalog Feed</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">CSV: name, sku, barcode, category, price, stock, supplier, tags</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="lumina-products-template.csv" className="text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center gap-1">
                  <Download className="w-4 h-4" /> Template
                </a>
                <button onClick={() => setIsCsvModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
            </header>
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {!csvPreview ? (
                <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[32px] p-12 flex flex-col items-center text-center hover:bg-indigo-50/30 cursor-pointer">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4"><FileUp className="w-8 h-8" /></div>
                  <h3 className="text-lg font-black text-slate-900 uppercase">Upload Source CSV</h3>
                  <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setCsvPreview(parseCSV(ev.target?.result as string)); r.readAsText(f); } }} accept=".csv" className="hidden" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><p className="text-xs font-black uppercase text-slate-900">{csvPreview.products.length} Items Validated</p><button onClick={() => setCsvPreview(null)} className="text-[10px] font-black uppercase text-indigo-600 hover:underline">Reset</button></div>
                  <div className="border rounded-2xl overflow-hidden text-[10px]">
                    <table className="w-full text-left"><thead className="bg-slate-50 border-b"><tr><th className="p-3">Name</th><th className="p-3">Ref</th><th className="p-3 text-right">Price</th></tr></thead><tbody className="divide-y">{csvPreview.products.slice(0, 8).map((p, i) => (<tr key={i}><td className="p-3 font-bold">{p.name}</td><td className="p-3 font-mono text-indigo-400">{p.id}</td><td className="p-3 text-right">{formatCurrency(p.price)}</td></tr>))}</tbody></table>
                  </div>
                </div>
              )}
            </div>
            <footer className="p-8 border-t bg-slate-50 flex gap-4">
              <button onClick={() => setIsCsvModalOpen(false)} className="flex-1 py-4 btn-negative text-[10px] uppercase">Cancel</button>
              <button onClick={() => { onBulkAddProducts(csvPreview!.products); setIsCsvModalOpen(false); }} disabled={!csvPreview} className="flex-[2] py-4 btn-positive text-[10px] uppercase disabled:opacity-50">Finalize Import</button>
            </footer>
          </div>
        </div>
      )}

      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSave} className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] border border-slate-100">
            <header className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
              <div><h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Product Entry</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Name, SKU/Barcode, Luxury Category, Price, Stock</p></div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Product Name</label>
                <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 uppercase" placeholder="e.g. Swiss Chronograph Watch" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                {showInternalRef && <p className="text-[9px] text-indigo-400 font-bold uppercase px-1 tracking-widest mt-1">ID: {slugify(editingProduct.name || '')}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">SKU</label>
                  <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="e.g. WCH-001" value={editingProduct.sku || ''} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Barcode</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="e.g. 1234567890123" value={editingProduct.barcode || ''} onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Luxury Category</label>
                <select className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900" value={editingProduct.luxuryCategory || editingProduct.category || ''} onChange={e => setEditingProduct({...editingProduct, luxuryCategory: e.target.value as LuxuryCategory, category: e.target.value})}>
                  {LUXURY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Price</label>
                  <input required type="number" step="0.01" min="0" className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Stock Quantity</label>
                  <input required type="number" min="0" className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: Number(e.target.value)})} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Min Stock Level (Safety Stock)</label>
                  <input type="number" min="0" className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="Flag when below this" value={editingProduct.minStockLevel ?? ''} onChange={e => setEditingProduct({...editingProduct, minStockLevel: e.target.value ? Number(e.target.value) : undefined})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Material</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="e.g. Leather, Gold" value={editingProduct.material || ''} onChange={e => setEditingProduct({...editingProduct, material: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Brand</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="e.g. Rolex, Gucci" value={editingProduct.brand || ''} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Designer</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="Designer name" value={editingProduct.designer || ''} onChange={e => setEditingProduct({...editingProduct, designer: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Seasonal Tags</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black" placeholder="e.g. SS24, Holiday" value={editingProduct.seasonalTags?.join(', ') || ''} onChange={e => setEditingProduct({...editingProduct, seasonalTags: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined})} />
                </div>
              </div>
            </div>
            <footer className="p-8 border-t bg-slate-50 flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 btn-negative text-[10px] uppercase">Discard</button>
              <button type="submit" className="flex-1 py-4 btn-positive text-[10px] uppercase">Commit</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
};

export default Inventory;

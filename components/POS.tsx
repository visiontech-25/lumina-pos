
import React, { useState, useEffect } from 'react';
import { Product, CartItem, Sale, User, Promotion, PriceList } from '../types';
import { TAX_RATE } from '../constants';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, CheckCircle, 
  ShoppingCart, Scan, X, ShoppingBag, ArrowRight, Sparkles, Phone, AlertCircle, 
  Camera, RotateCcw, Bell, Fingerprint, Loader2, Check, User as UserIcon
} from 'lucide-react';
import InvoiceModal from './InvoiceModal';
import { validateKenyanPhone, sendStkRequest, checkTransactionStatus, formatPhoneForDisplay } from '../services/mpesaService';
import { nativeService } from '../services/nativeService';
import { priceCart } from '../services/pricingService';
import aiService from '../services/aiService';

interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  preferences?: string[];
}

interface POSProps {
  products: Product[];
  customers?: CustomerProfile[];
  sales?: Sale[];
  onCompleteSale: (sale: Sale) => void | Promise<void>;
  updateProductStock?: (productId: string, quantity: number) => void;
  formatCurrency: (amount: number) => string;
  receiptOptions: {
    autoOpen: boolean;
    autoShare: boolean;
    autoDownload: boolean;
  };
  promotions: Promotion[];
  priceLists: PriceList[];
  channel: string;
  tableId?: string | null;
  onCancelTable?: () => void;
  onCheckoutError?: (message: string) => void;
}

interface FeedbackNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

const POS: React.FC<POSProps> = ({ products, customers = [], sales = [], onCompleteSale, updateProductStock, formatCurrency, receiptOptions, promotions, priceLists, channel, tableId, onCancelTable, onCheckoutError }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Advanced Visual Feedback States
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [animateTotal, setAnimateTotal] = useState(false);
  const [notifications, setNotifications] = useState<FeedbackNotification[]>([]);
  
  // M-Pesa Flow State
  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'sending' | 'pending' | 'success' | 'error'>('idle');
  const [mpesaError, setMpesaError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('lumina_current_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);

  const customerSales = selectedCustomer ? sales.filter(s => s.customerId === selectedCustomer.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [];

  useEffect(() => {
    if (selectedCustomer) {
      const recommendations = aiService.getRecommendedProducts(customerSales, products);
      setRecommendedProducts(recommendations);
    } else {
      setRecommendedProducts([]);
    }
  }, [selectedCustomer, customerSales, products]);

  const pricing = priceCart({
    cart,
    products,
    promotions,
    priceLists,
    ctx: {
      channel,
      now: new Date()
    }
  });

  const subtotal = pricing.subtotal;
  const promoDiscount = pricing.discountTotal;
  const manualDiscount = discountAmount;
  const discountedSubtotal = Math.max(0, subtotal - manualDiscount);
  const tax = discountedSubtotal * TAX_RATE;
  const total = discountedSubtotal + tax;

  // Trigger price animation when total changes with an elastic feel
  useEffect(() => {
    if (total > 0) {
      setAnimateTotal(true);
      const timer = setTimeout(() => setAnimateTotal(false), 400);
      return () => clearTimeout(timer);
    }
  }, [total]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm)
  );

  const addNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, type === 'error' ? 4000 : 2000);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    // Immediate Visual Feedback
    setRecentlyAddedId(product.id);
    nativeService.haptics.impact('LIGHT');
    
    // Logic for new item vs increment
    const isNew = !cart.some(item => item.id === product.id);
    if (isNew) addNotification(`${product.name} added to cart`);

    setTimeout(() => setRecentlyAddedId(null), 800);

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [
        ...prev,
        {
          ...product,
          quantity: 1,
          kitchenStation: channel === 'restaurant' ? 'kitchen' : undefined,
          kitchenStatus: channel === 'restaurant' ? 'new' : undefined
        }
      ];
    });
  };

  const editRestaurantMeta = (id: string) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const mods = prompt('Modifiers (comma separated)', (item.modifiers || []).join(', '));
    const course = prompt('Course (starter/main/dessert/drink)', item.course || '');
    const station = prompt('Station (kitchen/bar/dessert/cold/none)', item.kitchenStation || 'kitchen');
    setCart(prev =>
      prev.map(i =>
        i.id === id
          ? {
              ...i,
              modifiers: mods ? mods.split(',').map(s => s.trim()).filter(Boolean) : [],
              course: (course as any) || undefined,
              kitchenStation: (station as any) || undefined
            }
          : i
      )
    );
  };

  const finalizeCheckout = async (method: Sale['paymentMethod'], mpesaReceipt?: string) => {
    const effectiveDiscount = promoDiscount + (manualDiscount || 0);
    const newSale: Sale = {
      id: `SALE-${Date.now()}`,
      storeId: currentUser?.storeId || 'unknown',
      timestamp: new Date().toISOString(),
      items: [...cart],
      subtotal: discountedSubtotal,
      tax,
      total,
      paymentMethod: method,
      mpesaReceipt,
      discountAmount: effectiveDiscount > 0 ? effectiveDiscount : undefined,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerEmail: selectedCustomer?.email
    };
    try {
      await onCompleteSale(newSale);
      if (updateProductStock) {
        cart.forEach(item => updateProductStock(item.id, -item.quantity));
      }
      setCart([]);
      setShowSuccess(true);
      if (receiptOptions.autoOpen && !tableId) setLastSale(newSale);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed.';
      onCheckoutError?.(msg);
      addNotification(msg, 'error');
    }
  };

  const handleMpesaCheckout = async () => {
    if (!validateKenyanPhone(mpesaPhone)) {
      setMpesaError('Please enter a valid Kenyan phone number.');
      return;
    }
    setMpesaError('');
    setMpesaStatus('sending');
    
    try {
      const { checkoutRequestId } = await sendStkRequest(mpesaPhone, total);
      setMpesaStatus('pending');
      
      const result = await checkTransactionStatus(checkoutRequestId);
      if (result.success) {
        setMpesaStatus('success');
        setTimeout(async () => {
          setIsMpesaModalOpen(false);
          await finalizeCheckout('mpesa', result.receipt);
        }, 1500);
      } else {
        setMpesaStatus('error');
        setMpesaError(result.message);
      }
    } catch (err) {
      setMpesaStatus('error');
      setMpesaError('Network error connecting to Daraja API.');
    }
  };

  const handleCheckout = (method: Sale['paymentMethod']) => {
    if (cart.length === 0) return;
    if (method === 'mpesa') {
      setIsMpesaModalOpen(true);
      setMpesaStatus('idle');
      return;
    }
    finalizeCheckout(method);
  };

  return (
    <div className="flex flex-col h-full md:flex-row bg-gray-50 overflow-hidden relative">
      {/* Toast Notification Stack */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`backdrop-blur-md px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4 fade-in duration-300 ${n.type === 'error' ? 'bg-red-600/90 text-white' : 'bg-slate-900/90 text-white'}`}>
            {n.type === 'error' ? <AlertCircle className="w-3 h-3" /> : <Check className="w-3 h-3 text-emerald-400" />}
            {n.message}
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-white md:rounded-r-[40px] shadow-sm z-10">
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white md:rounded-tr-[40px]">
          {tableId && onCancelTable && (
            <button onClick={onCancelTable} className="btn-negative px-4 py-2 text-xs uppercase mr-4">
              Cancel Table
            </button>
          )}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search or Scan catalog..." className="w-full pl-10 pr-10 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-black text-xs font-medium transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button onClick={() => setIsScannerOpen(true)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-indigo-600"><Scan className="w-4 h-4" /></button>
          </div>
          <button 
            onClick={() => setIsCartOpen(true)} 
            className={`md:hidden relative p-3 bg-black text-white rounded-xl shadow-lg ml-3 transition-transform active:scale-95 ${recentlyAddedId ? 'animate-bounce' : 'scale-100'}`}
          >
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className={`absolute -top-1 -right-1 bg-red-600 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white transition-all ${recentlyAddedId ? 'animate-ping' : ''}`}>
                {cart.reduce((a,c)=>a+c.quantity,0)}
              </span>
            )}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4">
          {filteredProducts.map(product => {
            const isRecentlyAdded = recentlyAddedId === product.id;
            return (
              <button 
                key={product.id} 
                onClick={() => addToCart(product)} 
                disabled={product.stock <= 0} 
                className={`group bg-white border border-slate-100 p-2.5 rounded-2xl hover:border-black hover:shadow-lg transition-all active:scale-[0.97] text-left flex flex-col h-full relative ${product.stock <= 0 ? 'opacity-40 grayscale pointer-events-none' : ''}`}
              >
                {/* Floating Indicator */}
                {isRecentlyAdded && (
                  <div className="absolute top-0 right-0 z-50 pointer-events-none animate-out fade-out slide-out-to-top-8 duration-700 fill-mode-forwards">
                    <span className="text-emerald-500 font-black text-sm drop-shadow-md">+1</span>
                  </div>
                )}

                <div className="aspect-[4/3] rounded-xl bg-slate-50 overflow-hidden mb-2.5 border border-slate-100 relative shadow-inner">
                  <img src={product.image} className="w-full h-full object-cover transition-all group-hover:scale-110" />
                  
                  {/* Feedback Overlay */}
                  {isRecentlyAdded && (
                    <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                      <div className="bg-white rounded-full p-1.5 shadow-lg">
                        <Check className="w-4 h-4 text-emerald-600 stroke-[4px]" />
                      </div>
                      <span className="text-[8px] font-black text-white uppercase mt-1 drop-shadow-md">Added</span>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-[10px] line-clamp-2 mb-1 leading-tight uppercase flex-1">{product.name}</h3>
                {currentUser?.role === 'admin' && (
                  <div className="flex items-center gap-1 text-[7px] font-mono text-indigo-400 font-bold mb-2 uppercase opacity-60 group-hover:opacity-100">
                    <Fingerprint className="w-2.5 h-2.5" /> {product.id}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <span className="font-black text-black text-xs">{formatCurrency(product.price)}</span>
                  <span className={`text-[8px] font-bold ${product.stock <= 10 ? 'text-orange-500' : 'text-slate-400'}`}>{product.stock} LEFT</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`fixed inset-0 z-[100] md:relative md:inset-auto md:z-0 transition-all duration-300 ${isCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm md:hidden" onClick={() => setIsCartOpen(false)} />
        <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm md:relative md:w-80 md:max-w-none bg-white flex flex-col border-l border-slate-200">
          <header className="p-5 border-b flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-20">
            <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Active Order</h2>
            <button onClick={() => setIsCartOpen(false)} className="md:hidden p-1.5"><X className="w-5 h-5 text-slate-400" /></button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {cart.map(item => (
              <div key={item.id} className="bg-white border border-slate-100 p-3 rounded-2xl flex gap-3 group hover:border-black transition-all shadow-sm animate-in slide-in-from-right-2 duration-200">
                <div className="flex-1 min-w-0">
                  <h4 className="text-[10px] font-black text-slate-900 truncate uppercase">{item.name}</h4>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-black text-indigo-600">{formatCurrency(item.price)}</span>
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => { 
                        setCart(prev => prev.map(i => i.id === item.id ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0));
                        nativeService.haptics.impact('LIGHT');
                      }} className="p-1.5 hover:bg-white rounded-lg transition-colors"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                      <button onClick={() => { 
                        setCart(prev => prev.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1} : i));
                        nativeService.haptics.impact('LIGHT');
                      }} className="p-1.5 hover:bg-white rounded-lg transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                  {channel === 'restaurant' && (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-[9px] text-slate-500">
                        {(item.kitchenStation || 'kitchen').toUpperCase()} {item.course ? `• ${item.course}` : ''}{item.modifiers?.length ? ` • ${item.modifiers.length} mods` : ''}
                      </div>
                      <button onClick={() => editRestaurantMeta(item.id)} className="text-[9px] font-black uppercase text-indigo-600 hover:underline">
                        Mods/Course
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-300 opacity-50">
                <ShoppingBag className="w-12 h-12 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Cart is empty</p>
              </div>
            )}
          </div>
          <div className="p-6 border-t space-y-4 bg-white shrink-0">
            {customers.length > 0 && (
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Link Customer (Clienteling)
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 border-none rounded-xl text-[10px] font-bold outline-none appearance-none cursor-pointer"
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCustomer(id ? customers.find(c => c.id === id) || null : null);
                  }}
                >
                  <option value="">Walk-in</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ''}</option>
                  ))}
                </select>
                {selectedCustomer && (
                  <div className="glass-card p-3 space-y-3 text-[9px]">
                    {selectedCustomer.preferences && selectedCustomer.preferences.length > 0 && (
                      <div>
                        <p className="font-black uppercase text-slate-500 mb-1">Preferences</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedCustomer.preferences.map(p => <span key={p} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold text-[8px]">{p}</span>)}
                        </div>
                      </div>
                    )}
                    {customerSales.length > 0 && (
                      <div>
                        <p className="font-black uppercase text-slate-500 mb-1">Last Purchase ({new Date(customerSales[0].timestamp).toLocaleDateString()})</p>
                        <p className="text-slate-700 truncate">
                          {customerSales[0].items.map(i => i.name).join(', ')}
                        </p>
                      </div>
                    )}
                    {recommendedProducts.length > 0 && (
                      <div>
                        <p className="font-black uppercase text-slate-500 mb-1">Recommended For Them</p>
                        <div className="flex flex-wrap gap-1">
                          {recommendedProducts.map(p => <span key={p.id} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-[8px]">{p.name}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between items-end overflow-hidden">
              <span className="text-[10px] font-black uppercase text-slate-900">Grand Total</span>
              <span className={`text-xl font-black text-black leading-none transition-all duration-300 transform-gpu ${animateTotal ? 'scale-110 text-indigo-600 translate-y-[-2px]' : 'scale-100 translate-y-0'}`}>
                {formatCurrency(total)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
               <button
                 onClick={() => handleCheckout('cash')}
                 disabled={cart.length === 0}
                 className="btn-positive py-3 text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
               >
                 <Banknote className="w-3.5 h-3.5 text-white" /> Cash
               </button>
               <button
                 onClick={() => handleCheckout('mpesa')}
                 disabled={cart.length === 0}
                 className="btn-positive py-3 text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
               >
                 M-Pesa
               </button>
            </div>
            <button
              disabled={cart.length === 0}
              onClick={() => handleCheckout('card')}
              className="btn-positive w-full py-4 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              Complete Transaction <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isMpesaModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => mpesaStatus !== 'pending' && setIsMpesaModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-10 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#3ead33] text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-[#3ead33]/20">
              <Smartphone className="w-8 h-8" />
            </div>
            
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">M-Pesa STK Push</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Pay {formatCurrency(total)} securely</p>

            {mpesaStatus === 'idle' || mpesaStatus === 'error' ? (
              <div className="w-full space-y-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Customer Phone</label>
                  <input 
                    autoFocus
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-xl tracking-widest text-center"
                    placeholder="0712 345 678"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value.replace(/\D/g, ''))}
                  />
                  {mpesaError && <p className="text-[10px] text-red-500 font-black uppercase mt-2">{mpesaError}</p>}
                </div>
                <button 
                  onClick={handleMpesaCheckout}
                  disabled={mpesaPhone.length < 9}
                  className="w-full bg-[#3ead33] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-50"
                >
                  Send Push Request
                </button>
              </div>
            ) : mpesaStatus === 'sending' || mpesaStatus === 'pending' ? (
              <div className="flex flex-col items-center py-6 space-y-6">
                <Loader2 className="w-12 h-12 text-[#3ead33] animate-spin" />
                <div className="space-y-2">
                  <p className="text-sm font-black text-slate-900 uppercase">Awaiting Authorization</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Checking PIN entry on {formatPhoneForDisplay(mpesaPhone)}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 space-y-4">
                <CheckCircle className="w-16 h-16 text-[#3ead33]" />
                <p className="text-sm font-black text-slate-900 uppercase">Payment Received</p>
              </div>
            )}
            
            {mpesaStatus !== 'pending' && (
              <button 
                onClick={() => setIsMpesaModalOpen(false)}
                className="mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900"
              >
                Cancel Transaction
              </button>
            )}
          </div>
        </div>
      )}

      {lastSale && (
        <InvoiceModal
          sale={lastSale}
          onClose={() => setLastSale(null)}
          formatCurrency={formatCurrency}
          autoShare={receiptOptions.autoShare}
          autoDownload={receiptOptions.autoDownload}
        />
      )}
    </div>
  );
};

export default POS;

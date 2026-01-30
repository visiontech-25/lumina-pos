
import React, { useState, useMemo, useDeferredValue } from 'react';
import { Product, Prospect, CartItem, Sale, User } from '../types';
import { TAX_RATE } from '../constants';
import { 
  Search, 
  UserPlus, 
  Mail, 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2, 
  RotateCw,
  ShoppingBag,
  FileText,
  Send,
  CheckSquare,
  Square,
  Filter,
  Layers,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import InvoiceModal from './InvoiceModal';

interface ProspectsProps {
  // Added user prop to get current storeId context
  user: User;
  products: Product[];
  prospects: Prospect[];
  onAddProspect: (prospect: Prospect) => void;
  onUpdateProspect: (prospect: Prospect) => void;
  onCompleteSale: (sale: Sale) => void;
  updateProductStock: (productId: string, quantity: number) => void;
  // Added formatCurrency prop
  formatCurrency: (amount: number) => string;
}

const Prospects: React.FC<ProspectsProps> = ({ 
  user,
  products, 
  prospects, 
  onAddProspect, 
  onUpdateProspect,
  onCompleteSale,
  updateProductStock,
  formatCurrency
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<Prospect['status'] | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [inventorySearch, setInventorySearch] = useState('');
  
  // Use deferred value to keep the input responsive while filtering potentially large lists
  const deferredInventorySearch = useDeferredValue(inventorySearch);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({
    name: '',
    email: '',
    phone: '',
    status: 'draft',
    items: [],
    notes: '',
    terms: ''
  });
  const [selectedProspectForInvoice, setSelectedProspectForInvoice] = useState<Prospect | null>(null);
  const [shouldAutoShare, setShouldAutoShare] = useState(false);
  const [shouldAutoDownload, setShouldAutoDownload] = useState(false);

  const getEmailValidationError = (email: string) => {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Invalid email format";
    return null;
  };

  const emailError = useMemo(() => getEmailValidationError(newProspect.email || ''), [newProspect.email]);

  const filteredProspects = useMemo(() => {
    let filtered = prospects.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [prospects, searchTerm, sortOrder, filterStatus]);

  // Status counts for the filter chips
  const statusCounts = useMemo(() => {
    return prospects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, { draft: 0, sent: 0, 'follow-up': 0, converted: 0 } as Record<string, number>);
  }, [prospects]);

  // Optimization: Use deferred value and memoize the inventory search
  const filteredInventory = useMemo(() => {
    const search = deferredInventorySearch.toLowerCase().trim();
    if (!search) return products.slice(0, 50); // Show top 50 by default for instant rendering
    
    // Performance: Filter once and slice for UI efficiency
    return products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [products, deferredInventorySearch]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProspects.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredProspects.map(p => p.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkStatusUpdate = (status: Prospect['status']) => {
    prospects.forEach(p => {
      if (selectedIds.has(p.id)) onUpdateProspect({ ...p, status });
    });
    setSelectedIds(new Set());
  };

  const handleBulkEmail = () => {
    const selectedEmails = prospects.filter(p => selectedIds.has(p.id)).map(p => p.email).join(',');
    if (!selectedEmails) return;
    window.location.href = `mailto:?bcc=${selectedEmails}&subject=Quotation Update`;
    handleBulkStatusUpdate('sent');
  };

  const calculateTotal = (items: CartItem[]) => {
    const subtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    return subtotal + (subtotal * TAX_RATE);
  };

  const handleAddItem = (product: Product) => {
    const existing = newProspect.items?.find(i => i.id === product.id);
    let updatedItems: CartItem[] = [];
    if (existing) {
      updatedItems = (newProspect.items || []).map(i => 
        i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      );
    } else {
      updatedItems = [...(newProspect.items || []), { ...product, quantity: 1 }];
    }
    setNewProspect({ ...newProspect, items: updatedItems, total: calculateTotal(updatedItems) });
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    const updatedItems = (newProspect.items || []).map(item => 
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    );
    setNewProspect({ ...newProspect, items: updatedItems, total: calculateTotal(updatedItems) });
  };

  const handleRemoveItem = (id: string) => {
    const updatedItems = (newProspect.items || []).filter(i => i.id !== id);
    setNewProspect({ ...newProspect, items: updatedItems, total: calculateTotal(updatedItems) });
  };

  const handleSaveProspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProspect.email || emailError) return;
    // Fixed: Added missing storeId to the Prospect object
    const prospect: Prospect = {
      ...newProspect as Prospect,
      id: `PROP-${Date.now()}`,
      storeId: user.storeId,
      createdAt: new Date().toISOString()
    };
    onAddProspect(prospect);
    setIsModalOpen(false);
    setNewProspect({ name: '', email: '', phone: '', status: 'draft', items: [], notes: '', terms: '' });
    setInventorySearch('');
  };

  const handleConvertToSale = (prospect: Prospect) => {
    const subtotal = prospect.total / (1 + TAX_RATE);
    // Fixed: Added missing storeId to the Sale object
    const newSale: Sale = {
      id: `SALE-FROM-PROP-${Date.now()}`,
      storeId: prospect.storeId,
      timestamp: new Date().toISOString(),
      items: prospect.items,
      subtotal,
      tax: subtotal * TAX_RATE,
      total: prospect.total,
      paymentMethod: 'online',
      customerName: prospect.name,
      customerEmail: prospect.email,
      notes: prospect.notes,
      terms: prospect.terms
    };
    onCompleteSale(newSale);
    prospect.items.forEach(item => updateProductStock(item.id, -item.quantity));
    onUpdateProspect({ ...prospect, status: 'converted' });
  };

  const handleOpenInvoice = (prospect: Prospect, autoShare: boolean = false, autoDownload: boolean = false) => {
    setSelectedProspectForInvoice(prospect);
    setShouldAutoShare(autoShare);
    setShouldAutoDownload(autoDownload);
  };

  const handleCloseInvoice = () => {
    setSelectedProspectForInvoice(null);
    setShouldAutoShare(false);
    setShouldAutoDownload(false);
  };

  const getStatusStyles = (status: Prospect['status'] | 'all') => {
    switch (status) {
      case 'converted':
        return {
          container: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          active: 'bg-emerald-600 text-white border-emerald-600',
          dot: 'bg-emerald-500',
          accent: 'bg-emerald-500',
          icon: CheckCircle2
        };
      case 'sent':
        return {
          container: 'bg-blue-50 text-blue-700 border-blue-200',
          active: 'bg-blue-600 text-white border-blue-600',
          dot: 'bg-blue-500',
          accent: 'bg-blue-500',
          icon: Send
        };
      case 'follow-up':
        return {
          container: 'bg-violet-50 text-violet-700 border-violet-200',
          active: 'bg-violet-600 text-white border-violet-600',
          dot: 'bg-violet-500',
          accent: 'bg-violet-500',
          icon: RotateCw
        };
      case 'draft':
        return {
          container: 'bg-amber-50 text-amber-700 border-amber-200',
          active: 'bg-amber-600 text-white border-amber-600',
          dot: 'bg-amber-500',
          accent: 'bg-amber-500',
          icon: FileText
        };
      default:
        return {
          container: 'bg-slate-50 text-slate-700 border-slate-200',
          active: 'bg-black text-white border-black',
          dot: 'bg-slate-500',
          accent: 'bg-slate-500',
          icon: Layers
        };
    }
  };

  const filterTabs = [
    { id: 'all', label: 'All Leads', count: prospects.length },
    { id: 'draft', label: 'Drafts', count: statusCounts.draft },
    { id: 'sent', label: 'Sent', count: statusCounts.sent },
    { id: 'follow-up', label: 'Follow-up', count: statusCounts['follow-up'] },
    { id: 'converted', label: 'Converted', count: statusCounts.converted },
  ] as const;

  return (
    <div className="p-4 lg:p-8 space-y-8 h-full overflow-y-auto pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Prospect Pipeline</h1>
          <p className="text-gray-500 mt-1">Manage inquiries and track quotation status</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search leads..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-black outline-none transition-pro"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-md font-bold hover:opacity-90 transition-pro text-xs uppercase tracking-widest shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            New Quote
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 py-1 no-print">
        {filterTabs.map(tab => {
          const styles = getStatusStyles(tab.id as any);
          const isActive = filterStatus === tab.id;
          const Icon = styles.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-200
                ${isActive ? styles.active : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-900 shadow-sm'}
              `}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : ''}`} />
              {tab.label}
              <span className={`
                ml-1 px-1.5 py-0.5 rounded-full text-[9px]
                ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}
              `}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        {filteredProspects.length > 0 && (
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-black transition-pro"
            >
              {selectedIds.size === filteredProspects.length && selectedIds.size > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectedIds.size === filteredProspects.length && selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md">
              {selectedIds.size} Selected
            </span>
          </div>
        )}
        
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Showing {filteredProspects.length} results
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProspects.length === 0 ? (
          <div className="col-span-full py-24 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
            <Mail className="w-10 h-10 text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No matching leads in this view</p>
          </div>
        ) : (
          filteredProspects.map(prospect => {
            const styles = getStatusStyles(prospect.status);
            const StatusIcon = styles.icon;
            return (
              <div 
                key={prospect.id} 
                onClick={() => toggleSelect(prospect.id)}
                className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-400 transition-pro flex flex-col h-full relative cursor-pointer overflow-hidden ${
                  selectedIds.has(prospect.id) ? 'ring-2 ring-black bg-slate-50' : ''
                }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${styles.accent}`} />

                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0 pr-6">
                    <h3 className="font-bold text-slate-900 text-lg truncate leading-tight">{prospect.name}</h3>
                    <p className="text-xs text-slate-400 font-medium truncate">{prospect.email}</p>
                  </div>
                </div>

                <div className="mb-6 flex">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${styles.container}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {prospect.status}
                  </div>
                </div>

                <div className="flex-1 space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Quantity</p>
                      <p className="text-sm font-bold text-slate-900">{prospect.items.length} Units</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">Total Quote</p>
                      {/* Fixed: Use formatCurrency */}
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(prospect.total)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleOpenInvoice(prospect)}
                      className="bg-black text-white py-2 rounded-md font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1 hover:opacity-90"
                    >
                      View
                    </button>
                    <button 
                      onClick={() => handleOpenInvoice(prospect, true)}
                      className="bg-slate-100 text-black py-2 rounded-md font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-slate-200"
                    >
                      Share
                    </button>
                  </div>
                  {prospect.status !== 'converted' && (
                    <button 
                      onClick={() => handleConvertToSale(prospect)}
                      className="w-full bg-emerald-600 text-white py-2.5 rounded-md font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-emerald-700"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Convert to Sale
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 lg:bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4">
          <div className="bg-black text-white rounded-lg p-4 shadow-2xl flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-white/10 rounded flex items-center justify-center font-bold text-sm">
                {selectedIds.size}
              </span>
              <p className="text-xs font-bold uppercase tracking-widest">Selected Leads</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleBulkStatusUpdate('follow-up')} className="px-3 py-1.5 bg-slate-800 rounded text-[10px] font-bold uppercase hover:bg-slate-700">Follow-up</button>
              <button onClick={handleBulkEmail} className="px-3 py-1.5 bg-blue-600 rounded text-[10px] font-bold uppercase hover:bg-blue-500">Send</button>
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-red-900/40 rounded"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <form onSubmit={handleSaveProspect} className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <header className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Quotation</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Enter prospect details</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-md transition-pro"><X className="w-5 h-5" /></button>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              <div className="flex-1 p-6 space-y-6 overflow-y-auto border-r bg-white custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Customer Name</label>
                    <input required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-black outline-none" placeholder="e.g. John Smith" value={newProspect.name} onChange={e => setNewProspect({...newProspect, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Email Address</label>
                    <input required type="email" className={`w-full px-4 py-2 bg-slate-50 border rounded-md focus:ring-1 outline-none ${emailError ? 'border-red-500' : 'border-slate-200 focus:ring-black'}`} placeholder="name@email.com" value={newProspect.email} onChange={e => setNewProspect({...newProspect, email: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                      <MessageSquare className="w-3 h-3" />
                      Internal Notes
                    </div>
                    <textarea 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-black outline-none text-xs font-medium min-h-[80px] resize-none"
                      placeholder="Add any specific requirements or internal reminders..."
                      value={newProspect.notes}
                      onChange={e => setNewProspect({...newProspect, notes: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                      <ClipboardList className="w-3 h-3" />
                      Specific Terms & Conditions
                    </div>
                    <textarea 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md focus:ring-1 focus:ring-black outline-none text-xs font-medium min-h-[80px] resize-none"
                      placeholder="Enter custom terms for this specific quote (e.g. delivery date, extra warranty)..."
                      value={newProspect.terms}
                      onChange={e => setNewProspect({...newProspect, terms: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b pb-2">Line Items</h3>
                  {newProspect.items?.length === 0 ? (
                    <div className="py-12 border border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center">
                      <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">No items added yet</p>
                    </div>
                  ) : (
                    newProspect.items?.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-md">
                        <img src={item.image} className="w-10 h-10 rounded border border-slate-200 object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <button type="button" onClick={() => handleUpdateQuantity(item.id, -1)} className="p-1 border border-slate-200 rounded bg-white"><Minus className="w-2.5 h-2.5" /></button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button type="button" onClick={() => handleUpdateQuantity(item.id, 1)} className="p-1 border border-slate-200 rounded bg-white"><Plus className="w-2.5 h-2.5" /></button>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="w-80 p-6 bg-slate-50 flex flex-col shrink-0">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search inventory..."
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-black transition-pro shadow-sm"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Available Items</p>
                  {filteredInventory.length === 0 ? (
                    <p className="text-[10px] text-center text-slate-400 font-bold py-4">No products found</p>
                  ) : (
                    filteredInventory.map(p => (
                      <button 
                        key={p.id} 
                        type="button" 
                        onClick={() => handleAddItem(p)} 
                        className="w-full flex items-center gap-2.5 p-2 rounded-md bg-white border border-slate-200 hover:border-black transition-pro text-left shadow-sm"
                      >
                        <img src={p.image} className="w-8 h-8 rounded border border-slate-100 object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-slate-800 truncate">{p.name}</p>
                          {/* Fixed: Use formatCurrency */}
                          <p className="text-[9px] text-slate-500">{formatCurrency(p.price)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t mt-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Grand Total</span>
                    {/* Fixed: Use formatCurrency */}
                    <span className="text-xl font-black text-black tracking-tighter">{formatCurrency(newProspect.total || 0)}</span>
                  </div>
                  <button type="submit" disabled={!newProspect.items?.length || !newProspect.name || !newProspect.email || !!emailError} className="w-full bg-black text-white font-bold py-3.5 rounded-md hover:opacity-90 disabled:opacity-30 transition-pro text-sm uppercase tracking-widest shadow-xl">Save Quote</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {selectedProspectForInvoice && (
        <InvoiceModal 
          sale={{
            id: selectedProspectForInvoice.id,
            // Fixed: Added missing storeId to the Sale object
            storeId: selectedProspectForInvoice.storeId,
            timestamp: selectedProspectForInvoice.createdAt,
            items: selectedProspectForInvoice.items,
            subtotal: selectedProspectForInvoice.total / (1 + TAX_RATE),
            tax: (selectedProspectForInvoice.total / (1 + TAX_RATE)) * TAX_RATE,
            total: selectedProspectForInvoice.total,
            paymentMethod: 'quote',
            customerName: selectedProspectForInvoice.name,
            customerEmail: selectedProspectForInvoice.email,
            notes: selectedProspectForInvoice.notes,
            terms: selectedProspectForInvoice.terms
          }}
          onClose={handleCloseInvoice}
          autoShare={shouldAutoShare}
          autoDownload={shouldAutoDownload}
          // Fixed: Pass missing required formatCurrency prop
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
};

export default Prospects;

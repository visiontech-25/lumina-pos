import React, { useMemo, useState } from 'react';
import type { RestaurantSection, RestaurantTable, RestaurantOrder, RestaurantOrderState, Product } from '../types';
import { Plus, Edit, Trash2, Send, SplitSquareVertical, Percent, CreditCard, CookingPot } from 'lucide-react';
import { nativeService } from '../services/nativeService';
import { hardwareService } from '../services/hardwareService';

interface RestaurantProps {
  storeId: string;
  sections: RestaurantSection[];
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
  products: Product[];
  onSaveSections: (sections: RestaurantSection[]) => void;
  onSaveTables: (tables: RestaurantTable[]) => void;
  onSaveOrders: (orders: RestaurantOrder[]) => void;
  onSelectTable: (tableId: string) => void;
  onConvertOrderToSale?: (order: RestaurantOrder) => void;
  formatCurrency: (amount: number) => string;
}

const Restaurant: React.FC<RestaurantProps> = ({
  storeId,
  sections,
  tables,
  orders,
  products,
  onSaveSections,
  onSaveTables,
  onSaveOrders,
  onSelectTable,
  onConvertOrderToSale,
  formatCurrency
}) => {
  const [activeView, setActiveView] = useState<'floor' | 'sections' | 'tables'>('floor');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [editingSection, setEditingSection] = useState<RestaurantSection | null>(null);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [tipPercent, setTipPercent] = useState<number>(0);
  const [servicePercent, setServicePercent] = useState<number>(0);
  const [splitCount, setSplitCount] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');

  const getTableOrders = (tableId: string) => orders.filter(o => o.tableId === tableId && ['draft', 'sent', 'preparing', 'ready'].includes(o.state));
  const getTableStatus = (tableId: string): RestaurantTable['status'] => {
    const activeOrders = getTableOrders(tableId);
    if (activeOrders.length > 0) return 'occupied';
    return 'available';
  };

  const groupedTables = useMemo(() => sections.map(section => ({
    section,
    tables: tables.filter(t => t.sectionId === section.id)
  })), [sections, tables]);

  const updateOrderState = (orderId: string, newState: RestaurantOrderState) => {
    const updated = orders.map(o => 
      o.id === orderId 
        ? { ...o, state: newState, updatedAt: new Date().toISOString(), ...(newState === 'served' ? { servedAt: new Date().toISOString() } : {}), ...(newState === 'paid' ? { paidAt: new Date().toISOString() } : {}) }
        : o
    );
    onSaveOrders(updated);
    nativeService.haptics.impact('LIGHT');
  };

  const handleAddSection = () => {
    const newSection: RestaurantSection = {
      id: `SEC-${Date.now()}`,
      storeId,
      name: `Section ${sections.length + 1}`,
      displayOrder: sections.length
    };
    onSaveSections([...sections, newSection]);
    setIsAddingSection(false);
  };

  const handleAddTable = (sectionId: string) => {
    const sectionTables = tables.filter(t => t.sectionId === sectionId);
    const newTable: RestaurantTable = {
      id: `TBL-${Date.now()}`,
      storeId,
      sectionId,
      number: String(sectionTables.length + 1),
      capacity: 4,
      status: 'available'
    };
    onSaveTables([...tables, newTable]);
    setIsAddingTable(false);
  };

  const sendToKitchen = async (order: RestaurantOrder) => {
    // Mark items as sent + update order state
    const updatedOrders = orders.map(o => {
      if (o.id !== order.id) return o;
      return {
        ...o,
        state: 'sent',
        updatedAt: new Date().toISOString(),
        items: o.items.map(i => ({
          ...i,
          kitchenStatus: i.kitchenStation && i.kitchenStation !== 'none' ? 'sent' : i.kitchenStatus
        }))
      };
    });
    onSaveOrders(updatedOrders);

    // Build a simple kitchen ticket HTML for printer/KDS
    const table = tables.find(t => t.id === order.tableId);
    const ticketHtml = `
      <div style="font-family: monospace; padding: 8px;">
        <div style="font-weight: 800; font-size: 16px;">KITCHEN TICKET</div>
        <div>Table: ${table?.number || '?'}</div>
        <div>Order: ${order.id}</div>
        <div>${new Date().toLocaleString()}</div>
        <hr />
        ${order.items
          .filter(i => (i.kitchenStation || 'kitchen') !== 'none')
          .map(i => `
            <div style="margin: 6px 0;">
              <div><b>${i.quantity}x</b> ${i.name}</div>
              ${i.modifiers?.length ? `<div style="font-size: 12px;">- ${i.modifiers.join(', ')}</div>` : ''}
              ${i.course ? `<div style="font-size: 12px;">Course: ${i.course}</div>` : ''}
              ${i.kitchenStation ? `<div style="font-size: 12px;">Station: ${i.kitchenStation}</div>` : ''}
            </div>
          `).join('')}
      </div>
    `;
    try {
      await hardwareService.sendKitchenTicket({ title: `KITCHEN ${table?.number || ''}`, html: ticketHtml });
      nativeService.toast('Sent to kitchen');
    } catch {
      nativeService.toast('Kitchen ticket failed');
    }
  };

  const openPayModal = (orderId: string) => {
    setPayingOrderId(orderId);
    setTipPercent(0);
    setServicePercent(0);
    setSplitCount(1);
    setPaymentMethod('cash');
  };

  const confirmPayment = async () => {
    const order = orders.find(o => o.id === payingOrderId);
    if (!order) return;
    const tipAmount = Math.round((order.total * (tipPercent / 100)) * 100) / 100;
    const serviceChargeAmount = Math.round((order.total * (servicePercent / 100)) * 100) / 100;
    const finalTotal = Math.max(0, order.total + tipAmount + serviceChargeAmount);
    const updated: RestaurantOrder = {
      ...order,
      tipAmount,
      serviceChargeAmount,
      splitCount: Math.max(1, splitCount),
      paymentMethod,
      state: 'paid',
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveOrders(orders.map(o => (o.id === updated.id ? updated : o)));

    // Convert to sale(s)
    if (onConvertOrderToSale) {
      // Pass the enriched order; App handles receipt + ledger.
      await onConvertOrderToSale({ ...updated, total: finalTotal });
    }

    // Print receipt + open drawer (best-effort)
    const table = tables.find(t => t.id === order.tableId);
    const receiptHtml = `
      <div style="font-family: monospace; padding: 8px;">
        <div style="font-weight: 800; font-size: 16px;">RECEIPT</div>
        <div>Table: ${table?.number || '?'}</div>
        <div>Order: ${order.id}</div>
        <div>${new Date().toLocaleString()}</div>
        <hr />
        ${order.items.map(i => `
          <div style="display:flex; justify-content:space-between;">
            <span>${i.quantity}x ${i.name}</span>
            <span>${formatCurrency(i.price * i.quantity)}</span>
          </div>
          ${i.modifiers?.length ? `<div style="font-size: 12px;">- ${i.modifiers.join(', ')}</div>` : ''}
        `).join('')}
        <hr />
        <div style="display:flex; justify-content:space-between;"><b>Total</b><b>${formatCurrency(order.total)}</b></div>
        ${tipAmount ? `<div style="display:flex; justify-content:space-between;">Tip (${tipPercent}%)<span>${formatCurrency(tipAmount)}</span></div>` : ''}
        ${serviceChargeAmount ? `<div style="display:flex; justify-content:space-between;">Service (${servicePercent}%)<span>${formatCurrency(serviceChargeAmount)}</span></div>` : ''}
        <div style="display:flex; justify-content:space-between;"><b>Grand</b><b>${formatCurrency(finalTotal)}</b></div>
      </div>
    `;
    try {
      await hardwareService.printReceipt({ title: `TABLE ${table?.number || ''}`, html: receiptHtml });
      if (paymentMethod === 'cash') await hardwareService.openCashDrawer();
    } catch {
      // ignore
    }
    setPayingOrderId(null);
  };

  if (activeView === 'floor') {
    return (
      <div className="p-4 lg:p-8 h-full overflow-y-auto pb-32">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Restaurant Floor</h1>
            <p className="text-sm text-gray-500 mt-2">Manage tables and orders</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveView('sections')} className="btn-positive px-4 py-2 text-xs uppercase">Manage Sections</button>
            <button onClick={() => setActiveView('tables')} className="btn-positive px-4 py-2 text-xs uppercase">Manage Tables</button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groupedTables.map(({ section, tables: sectionTables }) => (
            <div key={section.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-black uppercase">{section.name}</h2>
                <button onClick={() => handleAddTable(section.id)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sectionTables.map(table => {
                  const status = getTableStatus(table.id);
                  const tableOrders = getTableOrders(table.id);
                  return (
                    <button
                      key={table.id}
                      onClick={() => onSelectTable(table.id)}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        status === 'occupied' 
                          ? 'border-orange-500 bg-orange-50' 
                          : status === 'reserved'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-slate-50 hover:border-indigo-500'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-lg">Table {table.number}</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          status === 'occupied' ? 'bg-orange-500 text-white' :
                          status === 'reserved' ? 'bg-blue-500 text-white' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Capacity: {table.capacity}</p>
                      {tableOrders.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-[10px] font-black text-slate-700">{tableOrders.length} active order{tableOrders.length > 1 ? 's' : ''}</p>
                          {tableOrders.map(order => (
                            <div key={order.id} className="mt-1 text-[9px] text-slate-600">
                              {order.state} • {formatCurrency(order.total)}
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {orders.filter(o => ['draft', 'sent', 'preparing', 'ready'].includes(o.state)).length > 0 && (
          <div className="mt-8 bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-black uppercase mb-4">Active Orders</h2>
            <div className="space-y-3">
              {orders.filter(o => ['draft', 'sent', 'preparing', 'ready'].includes(o.state)).map(order => {
                const table = tables.find(t => t.id === order.tableId);
                return (
                  <div key={order.id} className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                    <div>
                      <p className="font-black">Table {table?.number || '?'} • {formatCurrency(order.total)}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{order.items.length} items • {order.state}</p>
                    </div>
                    <div className="flex gap-2">
                      {order.state === 'draft' && (
                        <button
                          onClick={() => sendToKitchen(order)}
                          className="btn-positive px-3 py-1.5 text-[9px] uppercase flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Send
                        </button>
                      )}
                      {order.state === 'sent' && (
                        <button onClick={() => updateOrderState(order.id, 'preparing')} className="btn-positive px-3 py-1.5 text-[9px] uppercase">
                          Preparing
                        </button>
                      )}
                      {order.state === 'preparing' && (
                        <button onClick={() => updateOrderState(order.id, 'ready')} className="btn-positive px-3 py-1.5 text-[9px] uppercase">
                          Ready
                        </button>
                      )}
                      {order.state === 'ready' && (
                        <>
                          <button onClick={() => updateOrderState(order.id, 'served')} className="btn-positive px-3 py-1.5 text-[9px] uppercase">
                            Served
                          </button>
                          <button
                            onClick={() => openPayModal(order.id)}
                            className="btn-positive px-3 py-1.5 text-[9px] uppercase flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" /> Pay
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {payingOrderId && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur" onClick={() => setPayingOrderId(null)} />
            <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl p-6">
              <h3 className="text-sm font-black uppercase mb-4 flex items-center gap-2">
                <SplitSquareVertical className="w-4 h-4 text-indigo-600" /> Pay / Split / Tips
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Tip %</label>
                    <input value={tipPercent} onChange={e => setTipPercent(Number(e.target.value || 0))} type="number" className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl font-black" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Service %</label>
                    <input value={servicePercent} onChange={e => setServicePercent(Number(e.target.value || 0))} type="number" className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl font-black" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Split count</label>
                    <input value={splitCount} onChange={e => setSplitCount(Math.max(1, Number(e.target.value || 1)))} type="number" className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl font-black" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400">Payment</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full mt-1 px-4 py-3 bg-slate-50 rounded-2xl font-black">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="mpesa">M-Pesa</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={() => setPayingOrderId(null)} className="btn-negative flex-1 py-3 text-xs uppercase">Cancel</button>
                <button onClick={confirmPayment} className="btn-positive flex-1 py-3 text-xs uppercase">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeView === 'sections') {
    return (
      <div className="p-4 lg:p-8 h-full overflow-y-auto pb-32">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Sections</h1>
            <p className="text-sm text-gray-500 mt-2">Manage restaurant sections</p>
          </div>
          <button onClick={() => setActiveView('floor')} className="btn-negative px-4 py-2 text-xs uppercase">Back</button>
        </header>

        <div className="space-y-4">
          {sections.map(section => (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex justify-between items-center">
              <div>
                <p className="font-black">{section.name}</p>
                <p className="text-[10px] text-slate-500">Order: {section.displayOrder}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingSection(section)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => onSaveSections(sections.filter(s => s.id !== section.id))} className="p-2 hover:bg-red-100 rounded-xl">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
          <button onClick={handleAddSection} className="btn-positive w-full py-4 text-xs uppercase">
            <Plus className="w-4 h-4 inline mr-2" /> Add Section
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto pb-32">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Tables</h1>
          <p className="text-sm text-gray-500 mt-2">Manage restaurant tables</p>
        </div>
        <button onClick={() => setActiveView('floor')} className="btn-negative px-4 py-2 text-xs uppercase">Back</button>
      </header>

      <div className="space-y-4">
        {tables.map(table => {
          const section = sections.find(s => s.id === table.sectionId);
          return (
            <div key={table.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex justify-between items-center">
              <div>
                <p className="font-black">Table {table.number} ({section?.name || 'Unknown'})</p>
                <p className="text-[10px] text-slate-500">Capacity: {table.capacity} • Status: {table.status}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingTable(table)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => onSaveTables(tables.filter(t => t.id !== table.id))} className="p-2 hover:bg-red-100 rounded-xl">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Restaurant;

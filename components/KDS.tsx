import React, { useMemo, useState } from 'react';
import type { KitchenTicketStatus, RestaurantOrder, RestaurantTable } from '../types';
import { CookingPot, CheckCircle2, Clock, Flame, UtensilsCrossed } from 'lucide-react';
import { nativeService } from '../services/nativeService';

interface KDSProps {
  orders: RestaurantOrder[];
  tables: RestaurantTable[];
  station: 'kitchen' | 'bar' | 'dessert' | 'cold';
  onUpdateOrders: (orders: RestaurantOrder[]) => void;
}

const KDS: React.FC<KDSProps> = ({ orders, tables, station, onUpdateOrders }) => {
  const [filter, setFilter] = useState<KitchenTicketStatus>('new');

  const tickets = useMemo(() => {
    return orders
      .filter(o => ['sent', 'preparing', 'ready'].includes(o.state))
      .map(o => {
        const table = tables.find(t => t.id === o.tableId);
        const items = o.items.filter(i => (i.kitchenStation || 'kitchen') === station && (i.kitchenStation || 'kitchen') !== 'none');
        return { order: o, table, items };
      })
      .filter(t => t.items.length > 0);
  }, [orders, tables, station]);

  const setTicketStatus = (orderId: string, next: 'preparing' | 'ready' | 'served') => {
    const updated = orders.map(o => {
      if (o.id !== orderId) return o;
      const mappedOrderState: RestaurantOrder['state'] = next === 'served' ? 'served' : next;
      return {
        ...o,
        state: mappedOrderState,
        updatedAt: new Date().toISOString(),
        items: o.items.map(i => {
          if ((i.kitchenStation || 'kitchen') !== station) return i;
          return { ...i, kitchenStatus: next };
        })
      };
    });
    onUpdateOrders(updated);
    nativeService.haptics.impact('LIGHT');
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto pb-32">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">KDS</h1>
          <p className="text-sm text-slate-500">Station: {station.toUpperCase()}</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          {(['new', 'preparing', 'ready'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${filter === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tickets
          .filter(t => {
            if (filter === 'new') return t.order.state === 'sent';
            if (filter === 'preparing') return t.order.state === 'preparing';
            return t.order.state === 'ready';
          })
          .map(({ order, table, items }) => (
            <div key={order.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">Ticket</p>
                  <p className="text-lg font-black">Table {table?.number || '?'}</p>
                  <p className="text-[10px] text-slate-500">{order.id} • {new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full ${
                  order.state === 'sent' ? 'bg-orange-50 text-orange-600' :
                  order.state === 'preparing' ? 'bg-indigo-50 text-indigo-600' :
                  'bg-emerald-50 text-emerald-600'
                }`}>
                  {order.state}
                </span>
              </div>

              <div className="space-y-2">
                {items.map(i => (
                  <div key={`${order.id}:${i.id}`} className="bg-slate-50 rounded-2xl p-3">
                    <div className="flex justify-between items-start">
                      <p className="font-black text-sm">{i.quantity}x {i.name}</p>
                      <p className="text-[10px] font-black uppercase text-slate-400">{i.course || ''}</p>
                    </div>
                    {i.modifiers?.length ? (
                      <p className="text-[10px] text-slate-600 mt-1">- {i.modifiers.join(', ')}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                {order.state === 'sent' && (
                  <button onClick={() => setTicketStatus(order.id, 'preparing')} className="btn-positive flex-1 py-3 text-xs uppercase flex items-center justify-center gap-2">
                    <Flame className="w-4 h-4" /> Preparing
                  </button>
                )}
                {order.state === 'preparing' && (
                  <button onClick={() => setTicketStatus(order.id, 'ready')} className="btn-positive flex-1 py-3 text-xs uppercase flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Ready
                  </button>
                )}
                {order.state === 'ready' && (
                  <button onClick={() => setTicketStatus(order.id, 'served')} className="btn-positive flex-1 py-3 text-xs uppercase flex items-center justify-center gap-2">
                    <UtensilsCrossed className="w-4 h-4" /> Served
                  </button>
                )}
              </div>
            </div>
          ))}

        {tickets.length === 0 && (
          <div className="col-span-full bg-white rounded-[32px] border border-slate-200 shadow-sm p-10 text-center">
            <CookingPot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-xs font-black uppercase text-slate-400">No tickets</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KDS;


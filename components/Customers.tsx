import React, { useState } from 'react';
import type { Customer, LoyaltyAccount, Sale } from '../types';
import { Search, UserPlus, Star, Mail, Phone, Clock, Gift, ArrowUpRight } from 'lucide-react';

interface CustomersProps {
  customers: Customer[];
  loyaltyAccounts: LoyaltyAccount[];
  sales: Sale[];
  onSaveCustomers: (customers: Customer[]) => void;
  onSaveLoyalty: (accounts: LoyaltyAccount[]) => void;
}

const Customers: React.FC<CustomersProps> = ({
  customers,
  loyaltyAccounts,
  sales,
  onSaveCustomers,
  onSaveLoyalty
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);

  const openNew = () => {
    setEditing({
      name: '',
      email: '',
      phone: '',
      tags: [],
      notes: '',
      preferences: []
    });
    setIsModalOpen(true);
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });

  const findHistory = (customer: Customer) => {
    const custSales = sales.filter(s => s.customerId === customer.id || s.customerEmail === customer.email || s.customerName === customer.name);
    const totalLifetimeValue = custSales.reduce((acc, s) => acc + s.total, 0);
    const totalOrders = custSales.length;
    const lastOrderAt = custSales.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0]?.timestamp;
    return { totalLifetimeValue, totalOrders, lastOrderAt };
  };

  const getLoyalty = (customerId: string) =>
    loyaltyAccounts.find(l => l.customerId === customerId) || null;

  const saveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name) return;
    const now = new Date().toISOString();
    let list = [...customers];
    if (!editing.id) {
      const c: Customer = {
        ...(editing as Customer),
        id: `CUST-${Date.now()}`,
        storeId: customers[0]?.storeId || sales[0]?.storeId || 'unknown',
        createdAt: now,
        creditLimit: editing.creditLimit || 0,
        currentCreditBalance: editing.currentCreditBalance || 0,
        preferences: editing.preferences
      };
      list = [c, ...list];
    } else {
      list = list.map(c => (c.id === editing.id ? { ...c, ...editing } as Customer : c));
    }
    onSaveCustomers(list);
    setIsModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 h-full overflow-y-auto pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Customers</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Profiles, loyalty and purchasing history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-black outline-none"
              placeholder="Search name, email, or phone..."
            />
          </div>
          <button
            onClick={openNew}
            className="btn-positive px-6 py-3 text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> New Customer
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(c => {
          const history = findHistory(c);
          const loyalty = getLoyalty(c.id);
          return (
            <div
              key={c.id}
              className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-slate-900 text-lg truncate">{c.name}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {c.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditing(c);
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-50 rounded-xl hover:bg-slate-100"
                >
                  Edit
                </button>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Lifetime Value
                  </span>
                  <span className="text-base font-black text-slate-900">
                    {history.totalLifetimeValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Orders
                  </span>
                  <span className="text-base font-black text-slate-900">
                    {history.totalOrders}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>
                    {history.lastOrderAt
                      ? new Date(history.lastOrderAt).toLocaleDateString()
                      : 'No orders yet'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span className="font-black uppercase tracking-widest">
                    {loyalty ? loyalty.tier || 'Member' : 'No Tier'}
                  </span>
                </div>
              </div>

              {loyalty && (
                <div className="mt-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-700 uppercase tracking-widest">
                    <Gift className="w-3.5 h-3.5" />
                    <span>{loyalty.points} Points</span>
                  </div>
                  <button className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Redeem
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && editing && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          />
          <form
            onSubmit={saveCustomer}
            className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-8 space-y-5"
          >
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {editing.id ? 'Edit Customer' : 'New Customer'}
            </h2>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Name
              </label>
              <input
                required
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-black font-bold"
                value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-black text-sm"
                value={editing.email || ''}
                onChange={e => setEditing({ ...editing, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Phone
              </label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-black text-sm"
                value={editing.phone || ''}
                onChange={e => setEditing({ ...editing, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Preferences (Clienteling)
              </label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-black text-sm"
                placeholder="e.g. Likes Purple, Size M, Prefers Leather"
                value={(editing.preferences || []).join(', ')}
                onChange={e => setEditing({ ...editing, preferences: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : undefined })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 btn-negative py-3 text-[10px] uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 btn-positive py-3 text-[10px] uppercase tracking-widest"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Customers;


import React from 'react';
import { Sale, User } from '../types';
import { PackageCheck, PackageSearch, User as UserIcon, Clock } from 'lucide-react';

interface OnlineOrdersProps {
  sales: Sale[];
  onUpdateSale: (sale: Sale) => void;
  formatCurrency: (amount: number) => string;
  user: User;
}

const OnlineOrders: React.FC<OnlineOrdersProps> = ({ sales, onUpdateSale, formatCurrency, user }) => {
  const pendingOrders = sales.filter(s => s.status === 'pending_pickup' && s.orderType === 'pickup');

  const handleMarkAsCompleted = (sale: Sale) => {
    if (user.role !== 'admin' && !user.permissions.canManageInventory) {
      alert('You do not have permission to complete orders.');
      return;
    }
    onUpdateSale({ ...sale, status: 'completed' });
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Online Orders</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium">Manage orders placed online for in-store pickup.</p>
      </header>

      {pendingOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[40px] border shadow-sm">
          <PackageSearch className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-500">No Pending Pickups</h3>
          <p className="text-sm text-gray-400">All online orders have been collected.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingOrders.map(sale => (
            <div key={sale.id} className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-gray-800 uppercase">{sale.customerName || 'Guest'}</h3>
                  <p className="text-xs text-gray-400 font-mono">{sale.receiptNumber || sale.id}</p>
                </div>
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Pending</span>
              </div>
              <div className="space-y-2">
                {sale.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{item.name} x{item.quantity}</span>
                    <span className="font-medium text-gray-800">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(sale.total)}</span>
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1.5" />
                  <span>{new Date(sale.timestamp).toLocaleString()}</span>
                </div>
                {sale.customerEmail && (
                  <div className="flex items-center text-xs text-gray-500">
                    <UserIcon className="w-3 h-3 mr-1.5" />
                    <span>{sale.customerEmail}</span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => handleMarkAsCompleted(sale)}
                className="w-full btn-positive py-3 text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <PackageCheck className="w-5 h-5" /> Mark as Picked Up
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OnlineOrders;

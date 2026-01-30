
import React, { useState, useMemo } from 'react';
import { Sale } from '../types';
import { 
  Search, 
  ChevronRight, 
  Calendar, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Filter,
  ArrowUpRight,
  Clock,
  User,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Zap
} from 'lucide-react';
import InvoiceModal from './InvoiceModal';

interface SalesHistoryProps {
  sales: Sale[];
  formatCurrency: (amount: number) => string;
  onRefundSale: (sale: Sale) => void;
}

type SortField = 'timestamp' | 'total' | 'paymentMethod';
type SortDirection = 'asc' | 'desc';

const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, formatCurrency, onRefundSale }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const getPaymentIcon = (method: Sale['paymentMethod']) => {
    switch (method) {
      case 'cash': return <Banknote className="w-3.5 h-3.5 text-emerald-500" />;
      case 'card': return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
      case 'mpesa': return <Smartphone className="w-3.5 h-3.5 text-[#3ead33]" />;
      default: return <Smartphone className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filtered = useMemo(() => {
    return sales
      .filter(s => 
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'timestamp') {
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        } else if (sortField === 'total') {
          comparison = a.total - b.total;
        } else if (sortField === 'paymentMethod') {
          comparison = a.paymentMethod.localeCompare(b.paymentMethod);
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [sales, searchTerm, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-600" /> : <ChevronDown className="w-3 h-3 text-indigo-600" />;
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 pb-24 lg:pb-8 h-full overflow-y-auto bg-gray-50/30">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Ledger</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">Verified transaction history and auditing</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search ID, Customer, or Payment..." 
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all shadow-sm text-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
      </header>

      {/* Quick Sort Bar */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 px-1">Quick Analysis</p>
        <button 
          onClick={() => { setSortField('timestamp'); setSortDirection('desc'); }}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortField === 'timestamp' && sortDirection === 'desc' ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
        >
          Latest First
        </button>
        <button 
          onClick={() => { setSortField('total'); setSortDirection('desc'); }}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortField === 'total' && sortDirection === 'desc' ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
        >
          Highest Revenue
        </button>
        <button 
          onClick={() => { setSortField('paymentMethod'); setSortDirection('asc'); }}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortField === 'paymentMethod' ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
        >
          By Payment Type
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Transaction
                </th>
                <th 
                  className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('paymentMethod')}
                >
                  <div className="flex items-center gap-2">
                    Client / Channel
                    <SortIcon field="paymentMethod" />
                  </div>
                </th>
                <th 
                  className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center justify-center gap-2">
                    Date & Time
                    <SortIcon field="timestamp" />
                  </div>
                </th>
                <th 
                  className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Settlement
                    <SortIcon field="total" />
                  </div>
                </th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center opacity-20 gap-3">
                      <Clock className="w-10 h-10" />
                      <p className="text-xs font-black uppercase tracking-widest">No transactions logged</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 group transition-colors animate-in fade-in slide-in-from-bottom-1">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-indigo-600 font-black tracking-tighter uppercase">{sale.id}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {getPaymentIcon(sale.paymentMethod)}
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{sale.paymentMethod}</span>
                        </div>
                      </div>
                    </td>
                    <td className={`px-8 py-5 ${sortField === 'paymentMethod' ? 'bg-indigo-50/30' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                          {sale.customerName || 'Walk-in Customer'}
                        </span>
                      </div>
                    </td>
                    <td className={`px-8 py-5 text-center ${sortField === 'timestamp' ? 'bg-indigo-50/30' : ''}`}>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-900">{new Date(sale.timestamp).toLocaleDateString()}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className={`px-8 py-5 text-right font-black text-slate-900 text-base ${sortField === 'total' ? 'bg-indigo-50/30' : ''}`}>
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedSale(sale)} 
                          className="inline-flex items-center gap-2 bg-slate-100 text-slate-900 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-black hover:text-white transition-all active:scale-95"
                        >
                          Receipt <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onRefundSale(sale)}
                          disabled={sale.status === 'refunded'}
                          className="inline-flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-red-50 disabled:hover:text-red-600"
                          title={sale.status === 'refunded' ? 'Already refunded' : 'Refund this sale'}
                        >
                          Refund
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && <InvoiceModal sale={selectedSale} onClose={() => setSelectedSale(null)} formatCurrency={formatCurrency} />}
    </div>
  );
};

export default SalesHistory;

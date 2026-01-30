import React, { useState, useMemo } from 'react';
import type { Sale, Product, User } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users, Calendar, Download, Filter } from 'lucide-react';
import { exportSalesToCSV, downloadCSV } from '../services/exportService';

interface AnalyticsProps {
  user: User;
  sales: Sale[];
  products: Product[];
  formatCurrency: (amount: number) => string;
}

const Analytics: React.FC<AnalyticsProps> = ({ user, sales, products, formatCurrency }) => {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'transactions' | 'products'>('revenue');

  const filteredSales = useMemo(() => {
    const now = new Date();
    let start: Date;
    
    switch (dateRange) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return sales;
    }
    
    return sales.filter(s => new Date(s.timestamp) >= start);
  }, [sales, dateRange]);

  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = filteredSales.length;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const totalItemsSold = filteredSales.reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    
    const topProducts = products.map(p => {
      const sold = filteredSales.reduce((sum, s) => {
        const item = s.items.find(i => i.id === p.id);
        return sum + (item ? item.quantity : 0);
      }, 0);
      return { ...p, sold, revenue: sold * p.price };
    }).sort((a, b) => b.sold - a.sold).slice(0, 10);

    const dailyData = filteredSales.reduce((acc, sale) => {
      const date = new Date(sale.timestamp).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, revenue: 0, transactions: 0 };
      }
      acc[date].revenue += sale.total;
      acc[date].transactions += 1;
      return acc;
    }, {} as Record<string, { date: string; revenue: number; transactions: number }>);

    const paymentMethods = filteredSales.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRevenue,
      totalTransactions,
      avgTransactionValue,
      totalItemsSold,
      topProducts,
      dailyData: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
      paymentMethods
    };
  }, [filteredSales, products]);

  const handleExport = () => {
    const csv = exportSalesToCSV(filteredSales);
    downloadCSV(csv, `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto pb-32">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Advanced Analytics</h1>
          <p className="text-sm text-gray-500 mt-2">Real-time business intelligence and insights</p>
        </div>
        <div className="flex gap-2">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase">
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
          <button onClick={handleExport} className="btn-positive px-4 py-2 text-xs uppercase flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(metrics.totalRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="w-8 h-8 text-emerald-600" />
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Transactions</p>
          <p className="text-2xl font-black text-gray-900">{metrics.totalTransactions}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 text-orange-600" />
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Items Sold</p>
          <p className="text-2xl font-black text-gray-900">{metrics.totalItemsSold}</p>
        </div>
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-purple-600" />
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Avg Transaction</p>
          <p className="text-2xl font-black text-gray-900">{formatCurrency(metrics.avgTransactionValue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <h3 className="text-xs font-black uppercase mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <h3 className="text-xs font-black uppercase mb-4">Payment Methods</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(metrics.paymentMethods).map(([name, value]) => ({ name, value }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.keys(metrics.paymentMethods).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
        <h3 className="text-xs font-black uppercase mb-4">Top Products</h3>
        <div className="space-y-2">
          {metrics.topProducts.map((product, index) => (
            <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                  {index + 1}
                </span>
                <div>
                  <p className="font-black text-sm">{product.name}</p>
                  <p className="text-[10px] text-slate-500">Sold: {product.sold} units</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-sm">{formatCurrency(product.revenue)}</p>
                <p className="text-[10px] text-slate-500">{formatCurrency(product.price)} each</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;

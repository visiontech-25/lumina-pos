
import React, { useState, useMemo } from 'react';
import { Sale, Product, User, TelemetryData, FiscalReport } from '../types';
import { getSalesInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Sparkles, DollarSign, Zap, Loader2, Activity, Terminal, Shield, Gauge, Cpu, Cloud, RefreshCw, FileText, Download } from 'lucide-react';
import { getDeveloperHealthStream } from '../services/firebaseService';
import { generateXReport, generateZReport, generateEndOfDayReport } from '../services/fiscalReports';
import { storeRepo } from '../services/storeRepo';
import { nativeService } from '../services/nativeService';

interface ReportsProps {
  user: User;
  telemetry: TelemetryData;
  sales: Sale[];
  products: Product[];
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
}

const Reports: React.FC<ReportsProps> = ({ user, telemetry, sales, products, formatCurrency }) => {
  const [view, setView] = useState<'business' | 'dev' | 'fiscal'>('business');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState('');
  const [fiscalReports, setFiscalReports] = useState<FiscalReport[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  const devStream = useMemo(() => getDeveloperHealthStream(), []);

  const chartData = useMemo(() => {
    const dailyMap = new Map();
    sales.forEach(s => {
      const date = new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(date, (dailyMap.get(date) || 0) + s.total);
    });
    return Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));
  }, [sales]);

  React.useEffect(() => {
    storeRepo.getFiscalReports(user.storeId).then(setFiscalReports);
  }, [user.storeId]);

  const handleGenerateReport = async (type: 'X_REPORT' | 'Z_REPORT' | 'END_OF_DAY') => {
    setGeneratingReport(true);
    try {
      let report: FiscalReport;
      if (type === 'X_REPORT') {
        report = await generateXReport(user.storeId, user.name);
      } else if (type === 'Z_REPORT') {
        report = await generateZReport(user.storeId, user.name);
      } else {
        report = await generateEndOfDayReport(user.storeId, user.name);
      }
      setFiscalReports([report, ...fiscalReports]);
      nativeService.toast(`${type} generated successfully`);
    } catch (error) {
      nativeService.toast('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 h-full overflow-y-auto pb-32">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase">Intelligence</h1>
          <p className="text-sm text-slate-500 font-medium">Business growth and system health monitoring</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setView('business')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'business' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Business</button>
          <button onClick={() => setView('fiscal')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'fiscal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Fiscal Reports</button>
          <button onClick={() => setView('dev')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'dev' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400'}`}>Developer Portal</button>
        </div>
      </header>

      {view === 'fiscal' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => handleGenerateReport('X_REPORT')} disabled={generatingReport} className="btn-positive p-6 rounded-2xl text-left">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-xs font-black uppercase">X Report</p>
              <p className="text-[10px] text-white/80 mt-1">Current day summary</p>
            </button>
            <button onClick={() => handleGenerateReport('Z_REPORT')} disabled={generatingReport} className="btn-positive p-6 rounded-2xl text-left">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-xs font-black uppercase">Z Report</p>
              <p className="text-[10px] text-white/80 mt-1">Day closure</p>
            </button>
            <button onClick={() => handleGenerateReport('END_OF_DAY')} disabled={generatingReport} className="btn-positive p-6 rounded-2xl text-left">
              <FileText className="w-8 h-8 mb-2" />
              <p className="text-xs font-black uppercase">End of Day</p>
              <p className="text-[10px] text-white/80 mt-1">Daily summary</p>
            </button>
          </div>
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-black uppercase mb-4">Recent Reports</h3>
            <div className="space-y-2">
              {fiscalReports.slice(0, 10).map(report => (
                <div key={report.id} className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <p className="font-black text-sm">{report.type}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {new Date(report.startTime).toLocaleDateString()} - {new Date(report.endTime).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">Sales: {formatCurrency(report.totalSales)} • Tax: {formatCurrency(report.totalTax)} • Transactions: {report.transactionCount}</p>
                  </div>
                  <button className="p-2 hover:bg-slate-200 rounded-xl">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {fiscalReports.length === 0 && (
                <p className="text-[10px] text-slate-400 text-center py-8">No reports generated yet</p>
              )}
            </div>
          </div>
        </div>
      ) : view === 'business' ? (
        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                 <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4"><DollarSign className="w-5 h-5" /></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase">Revenue</p>
                 <p className="text-2xl font-black">{formatCurrency(sales.reduce((a,c)=>a+c.total, 0))}</p>
              </div>
              {/* Add more stats... */}
           </div>
           
           <div className="bg-white p-8 rounded-[32px] border shadow-sm">
              <h3 className="text-[10px] font-black uppercase mb-8">Sales Velocity Trend</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" hide />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="amount" fill="#4f46e5" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 p-6 rounded-[32px] text-white">
                 <Cpu className="w-10 h-10 text-indigo-400 mb-4" />
                 <p className="text-[10px] font-black text-indigo-300 uppercase">System Integrity</p>
                 <p className="text-2xl font-black">99.9% Healthy</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-[32px] text-white">
                 <Cloud className="w-10 h-10 text-emerald-400 mb-4" />
                 <p className="text-[10px] font-black text-emerald-300 uppercase">Cloud Pipeline</p>
                 <p className="text-2xl font-black">Active (Multi-Tenant)</p>
              </div>
              <div className="bg-slate-900 p-6 rounded-[32px] text-white">
                 <RefreshCw className="w-10 h-10 text-orange-400 mb-4" />
                 <p className="text-[10px] font-black text-orange-300 uppercase">Recent Syncs</p>
                 <p className="text-2xl font-black">{devStream.length} Operations</p>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[40px] border shadow-sm overflow-hidden">
              <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-600" /> Real-time Global Health Stream
              </h3>
              <div className="space-y-3">
                 {devStream.length === 0 ? (
                   <div className="py-20 text-center opacity-30 text-[10px] font-black uppercase">Waiting for stream data...</div>
                 ) : (
                   devStream.map((log: any, i: number) => (
                     <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 font-mono text-[10px]">
                        <div className="flex items-center gap-4">
                           <span className="text-slate-400">[{log.timestamp.slice(11, 19)}]</span>
                           <span className="text-indigo-600 font-black">STORE_{log.storeId}</span>
                           <span className="text-slate-900 uppercase">TYPE: {log.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-emerald-500">PAYLOAD_BATCH: {log.count}</span>
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                     </div>
                   )).reverse()
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

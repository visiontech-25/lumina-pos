
import React from 'react';
import { AuditEntry } from '../types';
import { History, ShieldAlert, User, Clock, Info, Shield } from 'lucide-react';

interface AuditLogProps {
  logs: AuditEntry[];
}

const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getSeverityStyles = (severity: AuditEntry['severity']) => {
    switch(severity) {
      case 'high': return 'bg-red-50 text-red-600 border-red-100';
      case 'medium': return 'bg-orange-50 text-orange-600 border-orange-100';
      default: return 'bg-blue-50 text-blue-600 border-blue-100';
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto h-full overflow-y-auto pb-32">
      <header>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Security Ledger</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium">Immutable log of administrative overrides and security events</p>
      </header>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Timestamp</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrator</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operation Details</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center opacity-20 gap-3">
                      {/* Fix: Replaced invalid ShieldInfo icon with the standard Shield icon */}
                      <Shield className="w-10 h-10" />
                      <p className="text-xs font-black uppercase tracking-widest">No security events recorded</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-xs font-bold text-slate-900">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-black px-3 py-1 bg-slate-100 rounded-full uppercase tracking-widest text-slate-600">
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="max-w-[300px]">
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{log.details}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getSeverityStyles(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;

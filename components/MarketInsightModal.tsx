
import React from 'react';
import { Product } from '../types';
import { X, Globe, ExternalLink, Sparkles, TrendingUp, Info, ShieldCheck } from 'lucide-react';

interface MarketInsightModalProps {
  product: Product;
  insight: { text: string; sources: { title: string; uri: string }[] } | null;
  onClose: () => void;
  isLoading: boolean;
  // Added formatCurrency prop
  formatCurrency: (amount: number) => string;
}

const MarketInsightModal: React.FC<MarketInsightModalProps> = ({ product, insight, onClose, isLoading, formatCurrency }) => {
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <header className="px-8 py-6 bg-indigo-600 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Globe className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight leading-none uppercase">Global Market Pulse</h2>
              <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Real-time AI Research: {product.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white">
            <X className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-indigo-600 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-gray-900 uppercase tracking-widest text-sm">Searching the Web...</p>
                <p className="text-gray-400 text-xs font-medium">Comparing prices and analyzing consumer sentiment</p>
              </div>
            </div>
          ) : insight ? (
            <div className="space-y-10">
              {/* Product Context */}
              <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <img src={product.image} className="w-20 h-20 rounded-2xl object-cover shadow-sm" alt="" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-900 text-lg truncate">{product.name}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    {/* Fixed: Use formatCurrency instead of hardcoded $ */}
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Current Price: {formatCurrency(product.price)}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</span>
                  </div>
                </div>
              </div>

              {/* Research Text */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">
                  <TrendingUp className="w-4 h-4" />
                  Analysis Summary
                </div>
                <div className="prose prose-slate max-w-none">
                  <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line font-medium">
                    {insight.text}
                  </div>
                </div>
              </div>

              {/* Sources */}
              {insight.sources.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                    <ShieldCheck className="w-4 h-4" />
                    Verified Market Sources
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {insight.sources.slice(0, 4).map((source, idx) => (
                      <a 
                        key={idx} 
                        href={source.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent rounded-2xl transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Globe className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                          <span className="text-xs font-bold text-slate-700 truncate">{source.title}</span>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <Info className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Unable to fetch market data</p>
            </div>
          )}
        </div>

        <footer className="p-8 bg-slate-50 border-t shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl active:scale-95"
          >
            Close Research
          </button>
        </footer>
      </div>
    </div>
  );
};

export default MarketInsightModal;

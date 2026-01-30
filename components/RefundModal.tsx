import React, { useState } from 'react';
import type { Sale } from '../types';
import { X, Minus, Plus } from 'lucide-react';

export interface RefundLinePlan {
  productId: string;
  maxQty: number;
  qty: number;
  writeOff: boolean;
}

interface RefundModalProps {
  sale: Sale;
  onConfirm: (lines: RefundLinePlan[]) => void;
  onCancel: () => void;
}

const RefundModal: React.FC<RefundModalProps> = ({ sale, onConfirm, onCancel }) => {
  const [lines, setLines] = useState<RefundLinePlan[]>(
    sale.items.map(i => ({
      productId: i.id,
      maxQty: i.quantity,
      qty: i.quantity,
      writeOff: false
    }))
  );

  const updateQty = (productId: string, delta: number) => {
    setLines(prev =>
      prev.map(l =>
        l.productId === productId
          ? { ...l, qty: Math.max(0, Math.min(l.maxQty, l.qty + delta)) }
          : l
      )
    );
  };

  const toggleWriteOff = (productId: string) => {
    setLines(prev =>
      prev.map(l =>
        l.productId === productId ? { ...l, writeOff: !l.writeOff } : l
      )
    );
  };

  const hasAnyQty = lines.some(l => l.qty > 0);

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl p-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Refund / Exchange
            </h2>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
              {sale.receiptNumber || sale.id}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
          {sale.items.map(item => {
            const plan = lines.find(l => l.productId === item.id)!;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-50 rounded-2xl p-3 border border-slate-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Max {plan.maxQty} pcs
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleWriteOff(item.id)}
                    className={`mt-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      plan.writeOff
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {plan.writeOff ? 'Write-off' : 'Return to stock'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, -1)}
                    className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-black">
                    {plan.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, 1)}
                    className="p-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 btn-negative py-3 text-[10px] uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasAnyQty}
            onClick={() => onConfirm(lines)}
            className="flex-1 btn-positive py-3 text-[10px] uppercase tracking-widest disabled:opacity-50"
          >
            Confirm Refund
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefundModal;


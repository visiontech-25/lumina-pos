import React from 'react';
import type { PurchaseOrder, GoodsReceipt, StockTransfer, StockCountSession } from '../types';
import { Package, Truck, ClipboardList, ArrowLeftRight } from 'lucide-react';

interface OperationsProps {
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  stockTransfers: StockTransfer[];
  stockCounts: StockCountSession[];
}

const Operations: React.FC<OperationsProps> = ({
  purchaseOrders,
  goodsReceipts,
  stockTransfers,
  stockCounts
}) => {
  return (
    <div className="p-4 lg:p-8 space-y-8 h-full overflow-y-auto pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">
            Operations
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Purchase orders, receipts, stocktakes and transfers
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">
              Purchase Orders
            </h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar text-xs">
            {purchaseOrders.map(po => (
              <div
                key={po.id}
                className="flex justify-between items-center bg-slate-50 rounded-2xl px-3 py-2"
              >
                <div>
                  <p className="font-black text-slate-900">{po.id}</p>
                  <p className="text-[10px] text-slate-500">
                    {po.status} • {po.lines.length} lines
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(po.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {purchaseOrders.length === 0 && (
              <p className="text-[11px] text-slate-400">No purchase orders yet.</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">
              Goods Receipts
            </h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar text-xs">
            {goodsReceipts.map(gr => (
              <div
                key={gr.id}
                className="flex justify-between items-center bg-slate-50 rounded-2xl px-3 py-2"
              >
                <div>
                  <p className="font-black text-slate-900">{gr.id}</p>
                  <p className="text-[10px] text-slate-500">
                    {gr.lines.length} lines • {gr.receivedBy}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(gr.receivedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {goodsReceipts.length === 0 && (
              <p className="text-[11px] text-slate-400">No goods receipts yet.</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-4 h-4 text-orange-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">
              Stocktakes
            </h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar text-xs">
            {stockCounts.map(sc => (
              <div
                key={sc.id}
                className="flex justify-between items-center bg-slate-50 rounded-2xl px-3 py-2"
              >
                <div>
                  <p className="font-black text-slate-900">{sc.id}</p>
                  <p className="text-[10px] text-slate-500">
                    {sc.lines.length} items • {sc.performedBy}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(sc.startedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {stockCounts.length === 0 && (
              <p className="text-[11px] text-slate-400">No stocktakes yet.</p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight className="w-4 h-4 text-sky-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-600">
              Stock Transfers
            </h2>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar text-xs">
            {stockTransfers.map(tr => (
              <div
                key={tr.id}
                className="flex justify-between items-center bg-slate-50 rounded-2xl px-3 py-2"
              >
                <div>
                  <p className="font-black text-slate-900">{tr.id}</p>
                  <p className="text-[10px] text-slate-500">
                    {tr.fromStoreId} → {tr.toStoreId} • {tr.lines.length} lines
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(tr.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {stockTransfers.length === 0 && (
              <p className="text-[11px] text-slate-400">No transfers yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Operations;


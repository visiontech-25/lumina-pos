
import React, { useState, useEffect } from 'react';
import { Sale, BusinessSettings } from '../types';
import { X, Printer, Mail, Smartphone, FileDown, Loader2, Check, Share2, QrCode } from 'lucide-react';

interface InvoiceModalProps {
  sale: Sale;
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  autoShare?: boolean;
  autoDownload?: boolean;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ sale, onClose, formatCurrency }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>({
    email: 'contact@lumina-pos.com',
    location: '123 Retail Plaza, Suite 400, Commerce City, 90210',
    phone: '+1 (555) 123-4567',
    refundPolicy: 'Goods once sold cannot be returned, no refunds.',
    currencyCode: 'USD',
    currencySymbol: '$'
  });

  useEffect(() => {
    // Prefer per-store settings (what App.tsx writes), fall back to legacy key.
    const savedSettings =
      localStorage.getItem(`lumina_${sale.storeId}_settings`) ||
      localStorage.getItem('lumina_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, [sale.storeId]);

  const isQuote = sale.paymentMethod === 'quote';

  const getCustomerFacingLabel = () => {
    const date = new Date(sale.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `Lumina ${isQuote ? 'Quote' : 'Receipt'} - ${dateStr} ${timeStr}`;
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    const element = document.getElementById('printable-invoice');
    const handler = (window as any).html2pdf;
    if (!handler) {
      alert("PDF Engine not ready. Please try again.");
      setIsGenerating(false);
      return;
    }
    
    try {
      await handler().set({
        margin: [10, 10],
        // Customer-facing file name (no internal receipt number / id)
        filename: `${getCustomerFacingLabel()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element).save();
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    // On Android WebView, window.print() is often unsupported.
    // Best-effort: generate a PDF and use the Web Share sheet (which can route to Print/Drive/etc).
    const element = document.getElementById('printable-invoice');
    const handler = (window as any).html2pdf;

    if (!element || !handler) {
      // Fallback for desktop browsers
      window.print();
      return;
    }

    setIsGenerating(true);
    try {
      // Customer-facing file name (no internal receipt number / id)
      const filename = `${getCustomerFacingLabel()}.pdf`;
      const worker = handler().set({
        margin: [10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element);

      // html2pdf exposes jsPDF output via outputPdf
      const blob: Blob = await worker.outputPdf('blob');

      // Try Web Share (Android / modern browsers)
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof (navigator as any).canShare === 'function' &&
        typeof (navigator as any).share === 'function';

      if (canShareFiles) {
        const file = new File([blob], filename, { type: 'application/pdf' });
        const nav: any = navigator as any;
        if (!nav.canShare || nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: filename });
          return;
        }
      }

      // Fallback: trigger a download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Print/share failed, falling back to window.print()', e);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmailReceipt = () => {
    const subject = encodeURIComponent(`${isQuote ? 'Quotation' : 'Receipt'} from Lumina Pro`);
    const itemsList = sale.items.map(i => `${i.name} x${i.quantity} - ${formatCurrency(i.price * i.quantity)}`).join('%0D%0A');
    const body = encodeURIComponent(
      `Hello ${sale.customerName || 'Valued Customer'},%0D%0A%0D%0A` +
      `Thank you for your business. Here are your transaction details:%0D%0A%0D%0A` +
      `Date: ${new Date(sale.timestamp).toLocaleString()}%0D%0A` +
      `Payment Method: ${sale.paymentMethod.toUpperCase()}%0D%0A%0D%0A` +
      `Items:%0D%0A${itemsList}%0D%0A%0D%0A` +
      `Total Amount: ${formatCurrency(sale.total)}%0D%0A%0D%0A` +
      `Best regards,%0D%0A${settings.email}`
    );
    
    window.location.href = `mailto:${sale.customerEmail || ''}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative border border-white/20">
        <header className="px-8 py-6 border-b flex justify-between items-center bg-white shrink-0 no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Smartphone className="text-white w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter leading-none">{isQuote ? 'Quotation' : 'Smart Receipt'}</h2>
              {(sale.receiptNumber || sale.id) && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Internal Ref: {sale.receiptNumber || sale.id}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleEmailReceipt} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors" title="Email Customer"><Mail className="w-5 h-5" /></button>
            <button onClick={handleDownloadPDF} disabled={isGenerating} className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-colors disabled:opacity-50" title="Save as PDF">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}</button>
            <button onClick={handlePrint} disabled={isGenerating} className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-colors disabled:opacity-50" title="Print / Share PDF">
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
            </button>
            <div className="w-px h-8 bg-slate-100 mx-2" />
            <button onClick={onClose} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X className="w-6 h-6" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar p-8">
          <div id="printable-invoice" className="p-12 bg-white text-gray-800 shadow-xl rounded-[32px] mx-auto border border-slate-100 printable-content">
            <div className="flex justify-between items-start mb-20">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 bg-black rounded-[20px] flex items-center justify-center shadow-2xl"><span className="text-3xl font-black text-white">L</span></div>
                  <div><h1 className="text-3xl font-black text-gray-900 tracking-tighter leading-none">LUMINA PRO</h1><p className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.3em] mt-1">Enterprise Systems</p></div>
                </div>
                <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed max-w-[240px]"><p className="mb-1">{settings.location}</p><p>{settings.phone}</p></div>
              </div>
              <div className="text-right">
                <div className="inline-block px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] mb-6">{isQuote ? 'Quotation' : 'Electronic Receipt'}</div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Date Issued</p>
                  <p className="text-sm font-black text-gray-900">{new Date(sale.timestamp).toLocaleDateString()}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-16 pb-12 border-b border-slate-100">
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-3">Customer Reference</p>
                <h4 className="text-base font-black text-slate-900">{sale.customerName || 'Walk-in Customer'}</h4>
                <p className="text-xs font-medium text-slate-500 mt-1">{sale.customerEmail || 'No profile email linked'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-3">Authentication</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100"><span className="text-xs font-black uppercase tracking-widest">{sale.paymentMethod} Verified</span><Check className="w-3.5 h-3.5" /></div>
                {sale.mpesaReceipt && <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase tracking-tighter">GATEWAY REF: {sale.mpesaReceipt}</p>}
              </div>
            </div>

            <table className="w-full mb-16">
              <thead><tr className="border-b-2 border-slate-900"><th className="py-4 text-left font-black text-slate-400 uppercase text-[10px] tracking-widest">Description</th><th className="py-4 text-center font-black text-slate-400 uppercase text-[10px] tracking-widest">Qty</th><th className="py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Price</th><th className="py-4 text-right font-black text-slate-400 uppercase text-[10px] tracking-widest">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map(item => (
                  <tr key={item.id}><td className="py-6"><span className="font-black text-slate-900 block text-sm">{item.name}</span><span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{item.sku}</span></td><td className="py-6 text-center font-black text-slate-600 text-sm">x{item.quantity}</td><td className="py-6 text-right font-bold text-slate-500 text-sm">{formatCurrency(item.price)}</td><td className="py-6 text-right font-black text-slate-900 text-sm">{formatCurrency(item.price * item.quantity)}</td></tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-start pt-8 border-t-2 border-slate-900">
              <div className="flex flex-col items-center p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm shrink-0">
                <QrCode className="w-24 h-24 text-slate-900" />
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mt-3 text-center">Scan to Verify<br/>Receipt Authenticity</p>
              </div>
              <div className="w-full max-w-[320px] space-y-4">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-400"><span>Subtotal Amount</span><span className="text-slate-900">{formatCurrency(sale.subtotal)}</span></div>
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-400"><span>Sales Tax (8%)</span><span className="text-slate-900">{formatCurrency(sale.tax)}</span></div>
                <div className="flex justify-between items-center py-6 px-6 bg-slate-900 text-white rounded-3xl mt-4"><span className="text-xs font-black uppercase tracking-[0.2em]">Total Due</span><span className="text-2xl font-black tracking-tighter">{formatCurrency(sale.total)}</span></div>
              </div>
            </div>

            <div className="mt-20 pt-12 border-t border-slate-100 flex justify-between items-end">
              <div className="max-w-[300px]">
                <h5 className="text-[10px] font-black uppercase text-slate-900 tracking-widest mb-3">Policy & Terms</h5>
                <p className="text-[10px] leading-relaxed text-slate-400 font-medium">{sale.terms || settings.refundPolicy}</p>
              </div>
              <div className="text-right"><p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">Digital Seal Verified: {btoa(sale.id).slice(0, 16)}</p></div>
            </div>
            <div className="mt-20 text-center"><p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-300">Lumina Retail Cloud • Enterprise POS v2025.1</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;

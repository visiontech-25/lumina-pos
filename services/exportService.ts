import type { Sale, Product, FiscalReport } from '../types';

export interface ExportOptions {
  format: 'PDF' | 'CSV' | 'EXCEL';
  includeCharts?: boolean;
}

export function exportSalesToCSV(sales: Sale[]): string {
  const headers = ['Receipt Number', 'Date', 'Items', 'Subtotal', 'Tax', 'Total', 'Payment Method'];
  const rows = sales.map(sale => [
    sale.receiptNumber || sale.id,
    new Date(sale.timestamp).toLocaleString(),
    sale.items.map(i => `${i.name} (x${i.quantity})`).join('; '),
    sale.subtotal.toFixed(2),
    sale.tax.toFixed(2),
    sale.total.toFixed(2),
    sale.paymentMethod
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportProductsToCSV(products: Product[]): string {
  const headers = ['SKU', 'Name', 'Category', 'Price', 'Stock', 'Supplier'];
  const rows = products.map(p => [
    p.sku,
    p.name,
    p.category,
    p.price.toFixed(2),
    p.stock.toString(),
    p.supplier || ''
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export function exportFiscalReportToCSV(report: FiscalReport): string {
  return [
    `Fiscal Report: ${report.type}`,
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `Period: ${new Date(report.startTime).toLocaleDateString()} - ${new Date(report.endTime).toLocaleDateString()}`,
    '',
    'Metric,Value',
    `Total Sales,${report.totalSales.toFixed(2)}`,
    `Total Tax,${report.totalTax.toFixed(2)}`,
    `Total Refunds,${report.totalRefunds.toFixed(2)}`,
    `Transaction Count,${report.transactionCount}`
  ].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(data: any, title: string): Promise<void> {
  // Simple HTML-based PDF generation
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to export PDF.');
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
          }
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 24px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${data}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 1000);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

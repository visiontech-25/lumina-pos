import type { Product, LabelTemplate } from '../types';

export interface PrintLabelOptions {
  product: Product;
  template?: LabelTemplate;
  quantity?: number;
}

export function generateBarcode(product: Product): string {
  const barcodeValue = product.barcode || product.sku || product.id;
  // Simple barcode representation - for full barcode generation, install jsbarcode: npm install jsbarcode
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = 200;
  canvas.height = 60;
  ctx.fillStyle = '#000';
  ctx.font = '12px monospace';
  ctx.fillText(barcodeValue, 10, 30);
  // Draw simple bars
  for (let i = 0; i < barcodeValue.length; i++) {
    const barWidth = 2;
    const barHeight = 40;
    if (i % 2 === 0) {
      ctx.fillRect(10 + i * barWidth, 35, barWidth, barHeight);
    }
  }
  return canvas.toDataURL('image/png');
}

export function generateShelfLabel(product: Product, template?: LabelTemplate): string {
  const defaultTemplate = `
    <div style="width: 4in; height: 2in; border: 1px solid #000; padding: 8px; font-family: Arial;">
      <div style="font-size: 18px; font-weight: bold;">${product.name}</div>
      <div style="font-size: 14px; margin-top: 4px;">SKU: ${product.sku}</div>
      <div style="font-size: 20px; font-weight: bold; margin-top: 8px;">$${product.price.toFixed(2)}</div>
      ${product.barcode ? `<img src="${generateBarcode(product)}" style="margin-top: 8px;" />` : ''}
    </div>
  `;
  
  if (template) {
    return template.content
      .replace(/\{\{name\}\}/g, product.name)
      .replace(/\{\{sku\}\}/g, product.sku)
      .replace(/\{\{price\}\}/g, product.price.toFixed(2))
      .replace(/\{\{barcode\}\}/g, generateBarcode(product));
  }
  
  return defaultTemplate;
}

export function generateItemLabel(product: Product, template?: LabelTemplate): string {
  return generateShelfLabel(product, template);
}

export async function printLabel(options: PrintLabelOptions): Promise<void> {
  const { product, template, quantity = 1 } = options;
  
  const labelHtml = generateShelfLabel(product, template);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups to print labels.');
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Label - ${product.name}</title>
        <style>
          @media print {
            @page { margin: 0; size: ${template?.width || 4}in ${template?.height || 2}in; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${Array(quantity).fill(labelHtml).join('<div style="page-break-after: always;"></div>')}
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

export function generateScaleBarcode(product: Product, weight: number, pricePerUnit: number): string {
  const barcodeValue = `${product.sku}${weight.toFixed(3)}${pricePerUnit.toFixed(2)}`;
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, barcodeValue, {
    format: 'EAN13',
    width: 2,
    height: 80,
    displayValue: true
  });
  return canvas.toDataURL('image/png');
}

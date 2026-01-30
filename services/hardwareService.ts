export type HardwarePlatform = 'web' | 'android' | 'desktop';

export interface PrintReceiptArgs {
  title: string;
  html: string; // printable HTML fragment (receipt/kitchen ticket)
}

export interface OpenCashDrawerArgs {
  // reserved for future: printer id, drawer port, pulse timings
}

export interface HardwareService {
  platform: HardwarePlatform;
  configure: (cfg: any) => void;
  printReceipt: (args: PrintReceiptArgs) => Promise<void>;
  openCashDrawer: (args?: OpenCashDrawerArgs) => Promise<void>;
  /**
   * Barcode scan can be implemented as:
   * - keyboard wedge (handled in UI input)
   * - camera scan (Capacitor MLKit / camera + decoder)
   */
  scanBarcode: () => Promise<{ barcode: string } | null>;
  /**
   * Restaurant: send kitchen ticket to KDS/printer.
   */
  sendKitchenTicket: (args: PrintReceiptArgs) => Promise<void>;
}

const detectPlatform = (): HardwarePlatform => {
  try {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) return 'android';
  } catch {
    // ignore
  }
  // Electron adds window.process?.versions?.electron in many setups
  if ((window as any).process?.versions?.electron) return 'desktop';
  return 'web';
};

const webHardwareService: HardwareService = {
  platform: 'web',
  configure() {
    // no-op on web
  },
  async printReceipt(args) {
    // Web printing is best-effort (HTML print).
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${args.title}</title></head><body>${args.html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
    win.document.close();
  },
  async openCashDrawer() {
    // Not supported on pure web without a local bridge.
    return;
  },
  async scanBarcode() {
    return null;
  },
  async sendKitchenTicket(args) {
    // Web fallback: print in browser
    return this.printReceipt({ title: args.title, html: args.html });
  }
};

/**
 * Minimal ESC/POS builder (58/80mm compatible).
 * We generate bytes and hand off to platform bridges.
 */
const escpos = {
  init(): Uint8Array {
    return new Uint8Array([0x1b, 0x40]); // ESC @
  },
  cut(): Uint8Array {
    return new Uint8Array([0x1d, 0x56, 0x41, 0x10]); // GS V A n
  },
  cashDrawerPulse(): Uint8Array {
    // ESC p m t1 t2
    return new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  },
  text(s: string): Uint8Array {
    const enc = new TextEncoder();
    return enc.encode(s);
  },
  lf(): Uint8Array {
    return new Uint8Array([0x0a]);
  },
  bold(on: boolean): Uint8Array {
    return new Uint8Array([0x1b, 0x45, on ? 1 : 0]);
  },
  align(mode: 'left' | 'center' | 'right'): Uint8Array {
    const n = mode === 'left' ? 0 : mode === 'center' ? 1 : 2;
    return new Uint8Array([0x1b, 0x61, n]);
  }
};

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function htmlToPlainText(html: string): string {
  // Best-effort: strip tags for ESC/POS
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

type LuminaHardwareBridge = {
  configure?: (cfg: any) => Promise<void>;
  printEscpos?: (args: { title?: string; bytesBase64: string; target?: 'receipt' | 'kitchen' }) => Promise<void>;
  openCashDrawer?: () => Promise<void>;
  scanBarcode?: () => Promise<{ barcode: string } | null>;
};

function getBridge(): LuminaHardwareBridge | null {
  // Android Capacitor plugin convention
  const cap = (window as any).Capacitor;
  const plugin = cap?.Plugins?.LuminaHardware;
  if (plugin) return plugin as LuminaHardwareBridge;
  // Electron preload convention
  const electronBridge = (window as any).luminaHardware;
  if (electronBridge) return electronBridge as LuminaHardwareBridge;
  return null;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export const hardwareService: HardwareService = (() => {
  const platform = detectPlatform();
  if (platform === 'web') return webHardwareService;
  const bridge = getBridge();
  let currentConfig: any = null;

  const bridged: HardwareService = {
    platform,
    configure(cfg: any) {
      currentConfig = cfg;
      if (bridge?.configure) {
        // best-effort
        bridge.configure(cfg).catch(() => {});
      }
    },
    async printReceipt(args) {
      // Prefer ESC/POS bridge if available, otherwise browser print.
      if (bridge?.printEscpos) {
        const text = htmlToPlainText(args.html);
        const bytes = concatBytes([
          escpos.init(),
          escpos.align('center'),
          escpos.bold(true),
          escpos.text(args.title + '\n'),
          escpos.bold(false),
          escpos.align('left'),
          escpos.text(text + '\n\n'),
          escpos.cut()
        ]);
        await bridge.printEscpos({ title: args.title, bytesBase64: toBase64(bytes), target: 'receipt' });
        return;
      }
      return webHardwareService.printReceipt(args);
    },
    async sendKitchenTicket(args) {
      if (bridge?.printEscpos) {
        const text = htmlToPlainText(args.html);
        const bytes = concatBytes([
          escpos.init(),
          escpos.align('center'),
          escpos.bold(true),
          escpos.text(args.title + '\n'),
          escpos.bold(false),
          escpos.align('left'),
          escpos.text(text + '\n\n'),
          escpos.cut()
        ]);
        await bridge.printEscpos({ title: args.title, bytesBase64: toBase64(bytes), target: 'kitchen' });
        return;
      }
      return webHardwareService.sendKitchenTicket(args);
    },
    async openCashDrawer() {
      if (bridge?.openCashDrawer) {
        await bridge.openCashDrawer();
        return;
      }
      if (bridge?.printEscpos) {
        const bytes = concatBytes([escpos.init(), escpos.cashDrawerPulse()]);
        await bridge.printEscpos({ bytesBase64: toBase64(bytes), target: 'receipt' });
        return;
      }
      return;
    },
    async scanBarcode() {
      if (bridge?.scanBarcode) return bridge.scanBarcode();
      return null;
    }
  };

  return bridged;
})();


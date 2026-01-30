import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, ipcMain } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
// import { autoUpdater } from 'electron-updater';
import net from 'net';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';

// Graceful handling of unhandled errors.
unhandled();

// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}

// If we are in Dev mode, use the file watcher components.
if (electronIsDev) {
  setupReloadWatcher(myCapacitorApp);
}

// Run Application
(async () => {
  // Wait for electron app to be ready.
  await app.whenReady();
  // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
  // Initialize our app, build windows, and load content.
  await myCapacitorApp.init();
  // Check for updates if we are in a packaged app.
  // autoUpdater.checkForUpdatesAndNotify();
})();

// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the dock icon is clicked.
app.on('activate', async function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});

// Place all ipc or other electron api calls and custom functionality under this line

type PrinterCfg = {
  connectionType: 'system' | 'network' | 'bluetooth' | 'usb';
  ip?: string;
  port?: number;
};

let hwConfig: any = null;

function fromBase64(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

async function sendTcpRaw(ip: string, port: number, payload: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(8000);
    socket.once('error', reject);
    socket.once('timeout', () => reject(new Error('Printer TCP timeout')));
    socket.connect(port, ip, () => {
      socket.write(payload, (err) => {
        if (err) return reject(err);
        socket.end();
      });
    });
    socket.on('close', () => resolve());
  });
}

function pickPrinter(target: 'receipt' | 'kitchen'): PrinterCfg | null {
  if (!hwConfig) return null;
  const p = target === 'kitchen' ? hwConfig?.kitchenPrinter : hwConfig?.receiptPrinter;
  return p || null;
}

ipcMain.handle('lumina-hw-configure', async (_evt, cfg) => {
  hwConfig = cfg;
  return { ok: true };
});

ipcMain.handle('lumina-hw-print', async (_evt, args: { bytesBase64: string; target?: 'receipt' | 'kitchen' }) => {
  const target = args.target || 'receipt';
  const printer = pickPrinter(target);
  if (!printer || printer.connectionType === 'system') {
    // System printing is handled by the renderer via browser print fallback.
    return { ok: true, mode: 'system' };
  }
  if (printer.connectionType === 'network') {
    if (!printer.ip) throw new Error('Missing printer IP');
    await sendTcpRaw(printer.ip, Number(printer.port || 9100), fromBase64(args.bytesBase64));
    return { ok: true, mode: 'network' };
  }
  throw new Error(`Unsupported printer type on desktop: ${printer.connectionType}. Use Network or System.`);
});

ipcMain.handle('lumina-hw-drawer', async () => {
  // Drawer pulse should be sent through the configured printer (ESC/POS pulse bytes are built in the app).
  // If using "system", there's nothing we can do at OS level.
  return { ok: true };
});

ipcMain.handle('lumina-hw-scan', async () => {
  // Desktop scanners usually act as keyboard wedges; handled in UI.
  return null;
});

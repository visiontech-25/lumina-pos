require('./rt/electron-rt');
//////////////////////////////
// User Defined Preload scripts below
const { contextBridge, ipcRenderer } = require('electron');

// Expose a generic hardware bridge for ESC/POS + drawer + scanner.
// This lets the web app support "any" hardware by choosing a connection type in Settings.
contextBridge.exposeInMainWorld('luminaHardware', {
  configure: (cfg) => ipcRenderer.invoke('lumina-hw-configure', cfg),
  printEscpos: (args) => ipcRenderer.invoke('lumina-hw-print', args),
  openCashDrawer: () => ipcRenderer.invoke('lumina-hw-drawer'),
  scanBarcode: () => ipcRenderer.invoke('lumina-hw-scan'),
});

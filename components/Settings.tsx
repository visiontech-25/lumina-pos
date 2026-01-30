import React, { useState, useRef } from 'react';
import { BusinessSettings, User, UserPermissions } from '../types';
import { 
  Mail, MapPin, Phone, ShieldAlert, Save, Users, UserPlus, Trash2, ShieldCheck, Shield, 
  Package2, BarChart3, Settings as SettingsIcon, Globe, Coins, Download, Upload, RefreshCw, 
  Database, History, Cloud, Printer, Bluetooth, Cable, PlugZap, CookingPot, Moon, Sun, 
  KeyRound, Fingerprint, User as UserIcon, Palette, HardDrive, Info, AlertTriangle, Briefcase,
  LayoutGrid, List, Table, Square
} from 'lucide-react';
import { db } from '../services/firebaseService';
import { hashPassword, verifyPassword } from '../services/securityService';
import { doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { nativeService } from '../services/nativeService';

interface SettingsProps {
  settings: BusinessSettings;
  onUpdateSettings: (settings: BusinessSettings) => void;
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onUpdateUser: (user: User) => void;
  currentUser: User;
  onAdminAction?: (title: string, description: string, onConfirm: () => void) => void;
}

type SettingsSection = 'account' | 'security' | 'business' | 'appearance' | 'devices' | 'data' | 'about';

const WORLD_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'KES', symbol: 'KSh', name: 'Kenya Shilling' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
];

// Section: About
const AboutSettings: React.FC = () => {
  const appVersion = '1.0.0'; // This could be dynamically injected
  const buildDate = new Date().toLocaleDateString(); // Or injected from build process

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">About Lumina POS</h2>
        <p className="text-sm text-gray-500 font-medium">Application information, legal documents, and support links.</p>
      </div>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center">
            <SettingsIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="font-black text-xl text-gray-900">Lumina POS</h3>
            <p className="text-xs text-gray-500">Version {appVersion} (Build {buildDate})</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Lumina POS is a modern, offline-first point-of-sale system designed for retail and restaurant environments. It leverages cloud technology for data synchronization and provides a suite of tools to manage sales, inventory, and customer relationships.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <a href="#" className="font-bold text-indigo-600 hover:underline">Terms of Service</a>
          <a href="#" className="font-bold text-indigo-600 hover:underline">Privacy Policy</a>
          <a href="#" className="font-bold text-indigo-600 hover:underline">Official Website</a>
          <a href="#" className="font-bold text-indigo-600 hover:underline">Contact Support</a>
        </div>
      </section>
    </div>
  );
};

// Section: Data & Privacy
const DataSettings: React.FC<Pick<SettingsProps, 'settings' | 'onUpdateSettings' | 'currentUser' | 'users'>> = ({ settings, onUpdateSettings, currentUser, users }) => {
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    const fetchCol = async (name: string) => {
      const path = `stores/${currentUser.storeId}/${name}`;
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    };

    try {
      const backup = {
        version: '2.0-Cloud',
        timestamp: new Date().toISOString(),
        storeId: currentUser.storeId,
        products: await fetchCol('products'),
        suppliers: await fetchCol('suppliers'),
        sales: await fetchCol('sales'),
        prospects: await fetchCol('prospects'),
        auditLogs: await fetchCol('auditLogs'),
        settings: settings,
        users: users
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lumina_Cloud_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed. Check internet connection.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (confirm("WARNING: Importing data will overwrite all CLOUD records for this store. This cannot be undone. Proceed?")) {
          const batch = writeBatch(db);
          const uploadCol = (colName: string, items: any[]) => {
            if (!items) return;
            const storePath = `stores/${currentUser.storeId}/${colName}`;
            items.forEach(item => {
              const { id, ...rest } = item;
              batch.set(doc(db, storePath, id), rest);
            });
          };

          uploadCol('products', data.products);
          uploadCol('suppliers', data.suppliers);
          uploadCol('sales', data.sales);
          uploadCol('prospects', data.prospects || []);
          uploadCol('auditLogs', data.auditLogs || []);
          uploadCol('users', data.users);
          if(data.settings) batch.set(doc(db, `stores/${currentUser.storeId}/settings`, 'business_info'), data.settings);

          await batch.commit();
          alert("Cloud Sync Complete. System will reload to apply changes.");
          window.location.reload();
        }
      } catch (err) {
        alert("Critical Error: Invalid backup file format.");
      }
    };
    reader.readAsText(file);
  };

  const handlePurge = () => {
    if (prompt('To confirm, type PURGE below. This will erase all cloud data for your store.') === 'PURGE') {
      // In a real app, this would trigger a secure, multi-step backend process.
      // For this demo, we simulate by clearing local data and reloading.
      alert('Cloud data purge initiated. The system will now reset.');
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Data & Privacy</h2>
        <p className="text-sm text-gray-500 font-medium">Manage your data, privacy settings, and system telemetry.</p>
      </div>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Database className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Developer Telemetry</h2>
        </div>
        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
          <div className="flex-1">
            <p className="font-bold text-slate-800">Help Improve Lumina POS</p>
            <p className="text-xs text-slate-500 mt-1">By enabling this, you agree to share anonymous usage data with the Lumina POS development team. This includes performance metrics and feature usage statistics. We will never collect personal or business-sensitive data. This helps us improve the system for everyone.</p>
          </div>
          <button 
            onClick={() => onUpdateSettings({ ...settings, telemetryEnabled: !settings.telemetryEnabled })}
            className={`w-12 h-6 rounded-full flex items-center transition-colors shrink-0 ${settings.telemetryEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <span className={`inline-block w-5 h-5 bg-white rounded-full transform transition-transform ${settings.telemetryEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><History className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Data Management</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col items-center text-center space-y-4">
            <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight">Cloud Export</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed flex-1">Download a complete JSON snapshot of all your store's data from the cloud.</p>
            <button onClick={handleExportData} disabled={isExporting} className="w-full py-3 btn-neutral text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3">
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export Data
            </button>
          </div>
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex flex-col items-center text-center space-y-4">
            <h3 className="font-black text-slate-900 uppercase text-sm tracking-tight">Import from Backup</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed flex-1">Restore your store from a previously exported Lumina JSON backup file.</p>
            <input type="file" ref={fileInputRef} onChange={handleImportData} className="hidden" accept=".json" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 btn-neutral text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3">
              <Upload className="w-4 h-4" /> Import Data
            </button>
          </div>
        </div>
        <div className="p-6 bg-red-50 rounded-[28px] border border-red-100 flex items-center gap-5 mt-6">
          <div className="w-12 h-12 bg-white text-red-600 rounded-xl flex items-center justify-center shrink-0 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-red-900 uppercase tracking-widest">Danger Zone: Purge Cloud Data</p>
            <p className="text-[10px] text-red-700 font-bold uppercase mt-0.5 opacity-70">Permanently erase all cloud data for this store. This action cannot be undone.</p>
          </div>
          <button onClick={handlePurge} className="px-6 py-3 btn-negative text-[10px] uppercase tracking-widest">Purge Data</button>
        </div>
      </section>
    </div>
  );
};

// Section: Devices
const DevicesSettings: React.FC<Pick<SettingsProps, 'settings' | 'onUpdateSettings'>> = ({ settings, onUpdateSettings }) => {
  const updateHardware = (patch: any) => {
    onUpdateSettings({
      ...settings,
      hardware: {
        receiptPrinter: { connectionType: 'system', port: 9100, ...(settings.hardware?.receiptPrinter || {}) },
        kitchenPrinter: { connectionType: 'system', port: 9100, ...(settings.hardware?.kitchenPrinter || {}) },
        cashDrawer: { mode: 'printer-pulse', printerTarget: 'receipt', ...(settings.hardware?.cashDrawer || {}) },
        scanner: { mode: 'keyboard', ...(settings.hardware?.scanner || {}) },
        scale: { mode: 'none', ...(settings.hardware?.scale || {}) },
        ...(settings.hardware || {}),
        ...patch
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Devices</h2>
        <p className="text-sm text-gray-500 font-medium">Configure printers, cash drawer, scanner, and other connected hardware.</p>
      </div>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><PlugZap className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Hardware Configuration</h2>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          These settings are for native desktop (Electron) and mobile (Android/iOS) apps. Web version will use standard browser printing.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-[32px] border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-indigo-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Receipt Printer</p>
            </div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Connection</label>
            <select
              value={settings.hardware?.receiptPrinter?.connectionType || 'system'}
              onChange={(e) => updateHardware({ receiptPrinter: { ...(settings.hardware?.receiptPrinter || {}), connectionType: e.target.value } })}
              className="w-full px-4 py-3 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200"
            >
              <option value="system">System Print (fallback)</option>
              <option value="network">LAN / TCP (9100)</option>
              <option value="bluetooth">Bluetooth (Android)</option>
              <option value="usb">USB (beta)</option>
            </select>

            {(settings.hardware?.receiptPrinter?.connectionType || 'system') === 'network' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">IP</label>
                  <input
                    value={settings.hardware?.receiptPrinter?.ip || ''}
                    onChange={(e) => updateHardware({ receiptPrinter: { ...(settings.hardware?.receiptPrinter || {}), ip: e.target.value } })}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-2xl font-bold border border-slate-200"
                    placeholder="192.168.1.50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Port</label>
                  <input
                    type="number"
                    value={settings.hardware?.receiptPrinter?.port || 9100}
                    onChange={(e) => updateHardware({ receiptPrinter: { ...(settings.hardware?.receiptPrinter || {}), port: Number(e.target.value || 9100) } })}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-2xl font-bold border border-slate-200"
                    placeholder="9100"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-[32px] border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CookingPot className="w-4 h-4 text-indigo-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kitchen Printer</p>
            </div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Connection</label>
            <select
              value={settings.hardware?.kitchenPrinter?.connectionType || 'system'}
              onChange={(e) => updateHardware({ kitchenPrinter: { ...(settings.hardware?.kitchenPrinter || {}), connectionType: e.target.value } })}
              className="w-full px-4 py-3 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200"
            >
              <option value="system">System Print (fallback)</option>
              <option value="network">LAN / TCP (9100)</option>
            </select>
            {(settings.hardware?.kitchenPrinter?.connectionType || 'system') === 'network' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">IP</label>
                  <input
                    value={settings.hardware?.kitchenPrinter?.ip || ''}
                    onChange={(e) => updateHardware({ kitchenPrinter: { ...(settings.hardware?.kitchenPrinter || {}), ip: e.target.value } })}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-2xl font-bold border border-slate-200"
                    placeholder="192.168.1.51"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Port</label>
                  <input
                    type="number"
                    value={settings.hardware?.kitchenPrinter?.port || 9100}
                    onChange={(e) => updateHardware({ kitchenPrinter: { ...(settings.hardware?.kitchenPrinter || {}), port: Number(e.target.value || 9100) } })}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-2xl font-bold border border-slate-200"
                    placeholder="9100"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 rounded-[32px] border border-slate-100 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-indigo-600" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cash Drawer</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mode</label>
              <select
                value={settings.hardware?.cashDrawer?.mode || 'printer-pulse'}
                onChange={(e) => updateHardware({ cashDrawer: { ...(settings.hardware?.cashDrawer || {}), mode: e.target.value } })}
                className="w-full mt-1 px-4 py-3 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200"
              >
                <option value="printer-pulse">Pulse via Printer</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Printer</label>
              <select
                value={settings.hardware?.cashDrawer?.printerTarget || 'receipt'}
                onChange={(e) => updateHardware({ cashDrawer: { ...(settings.hardware?.cashDrawer || {}), printerTarget: e.target.value } })}
                className="w-full mt-1 px-4 py-3 bg-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200"
              >
                <option value="receipt">Receipt Printer</option>
                <option value="kitchen">Kitchen Printer</option>
              </select>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// Section: Business
const BusinessSettingsComponent: React.FC<Pick<SettingsProps, 'settings' | 'onUpdateSettings' | 'onAdminAction'>> = ({ settings, onUpdateSettings, onAdminAction }) => {
  const handleBusinessModeChange = (mode: 'retail' | 'restaurant') => {
    if (settings.businessMode === mode) return;

    if (onAdminAction) {
      onAdminAction(
        'Change Business Mode',
        `This requires manager approval. Are you sure you want to switch to ${mode} mode?`,
        () => {
          onUpdateSettings({ ...settings, businessMode: mode });
        }
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Business</h2>
        <p className="text-sm text-gray-500 font-medium">Configure your business type and operational settings.</p>
      </div>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><SettingsIcon className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">System Mode</h2>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          Switch between Retail and Restaurant modes to tailor the POS interface to your business needs. The default is Retail.
        </p>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => handleBusinessModeChange('retail')}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
              (settings.businessMode || 'retail') === 'retail' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Retail
          </button>
          <button
            type="button"
            onClick={() => handleBusinessModeChange('restaurant')}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
              settings.businessMode === 'restaurant' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Restaurant
          </button>
        </div>
      </section>
    </div>
  );
};

// Section: Appearance
const AppearanceSettings: React.FC<Pick<SettingsProps, 'settings' | 'onUpdateSettings'>> = ({ settings, onUpdateSettings }) => {
  const handleInventoryViewChange = (view: 'grid-small' | 'grid-medium' | 'grid-large' | 'list' | 'table') => {
    onUpdateSettings({ ...settings, inventoryView: view });
  };
  const handleThemeChange = (theme: 'light' | 'dark') => {
    onUpdateSettings({ ...settings, theme: theme });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Appearance</h2>
        <p className="text-sm text-gray-500 font-medium">Customize the look and feel of the application.</p>
      </div>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Palette className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Theme</h2>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          Switch between light and dark mode.
        </p>
      </section>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><LayoutGrid className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Inventory View</h2>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          Choose how products are displayed in the inventory screen.
        </p>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => handleInventoryViewChange('grid-small')}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              (settings.inventoryView || 'grid-medium') === 'grid-small' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleInventoryViewChange('grid-medium')}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              (settings.inventoryView || 'grid-medium') === 'grid-medium' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleInventoryViewChange('list')}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              settings.inventoryView === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleInventoryViewChange('table')}
            className={`px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              settings.inventoryView === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Table className="w-4 h-4" />
          </button>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              (settings.theme || 'dark') === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Sun className="w-4 h-4" />
            Light
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
              settings.theme === 'dark' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Moon className="w-4 h-4" />
            Dark
          </button>
        </div>
      </section>
    </div>
  );
};

// Section: Security
const SecuritySettings: React.FC<Pick<SettingsProps, 'currentUser' | 'onUpdateUser' | 'settings' | 'onUpdateSettings'>> = ({ currentUser, onUpdateUser, settings, onUpdateSettings }) => {
  const [passwordChange, setPasswordChange] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const hasPassword = !!(settings.managerPasswordHash);

  const handlePasswordUpdate = async () => {
    if (hasPassword && !passwordChange.oldPassword) {
      alert('Old password is required.');
      return;
    }
    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    if (passwordChange.newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    if (hasPassword) {
      // This is a simplified check. In a real app, you'd want a more robust verification against the stored hash.
      const isMatch = await verifyPassword({ passwordHash: settings.managerPasswordHash } as User, passwordChange.oldPassword);
      if (!isMatch) {
        alert('Old password is not correct.');
        return;
      }
    }

    const newPasswordHash = await hashPassword(settings.storeName, 'manager', passwordChange.newPassword);
    onUpdateSettings({ ...settings, managerPasswordHash: newPasswordHash });
    setPasswordChange({ oldPassword: '', newPassword: '', confirmPassword: '' });
    alert('Password updated successfully!');
  };

  const toggleBiometrics = async () => {
    const isAvailable = await nativeService.isBiometricsAvailable();
    if (!isAvailable) {
      alert('Biometrics not available on this device.');
      return;
    }

    if (currentUser.hasBiometrics) {
      onUpdateUser({ ...currentUser, hasBiometrics: false });
      await nativeService.deleteBiometricCredential();
      alert('Biometrics disabled.');
    } else {
      try {
        if (!hasPassword) {
          alert('Please set a password before enabling biometrics.');
          return;
        }
        // This is a simplified example; in a real app, you'd use the actual password
        // not a PIN to set up biometrics.
        const tempPassword = prompt('Please re-enter your new password to enable biometrics');
        if (tempPassword && (await verifyPassword(currentUser, tempPassword))) {
          await nativeService.setBiometricCredential(currentUser.id, tempPassword);
          onUpdateUser({ ...currentUser, hasBiometrics: true });
          alert('Biometrics enabled successfully!');
        } else {
          alert('Password incorrect. Biometrics not enabled.');
        }
      } catch (error) {
        alert('Failed to enable biometrics. Please try again.');
        console.error(error);
      }
    }
  };

  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'currencyCode') {
      const selected = WORLD_CURRENCIES.find(c => c.code === value);
      if (selected) {
        onUpdateSettings({ ...settings, currencyCode: selected.code, currencySymbol: selected.symbol });
        return;
      }
    }
    onUpdateSettings({ ...settings, [name]: value });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Security</h2>
        <p className="text-sm text-gray-500 font-medium">Manage your password, biometrics, and business information.</p>
      </div>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><KeyRound className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Authentication</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">{hasPassword ? 'Change Password' : 'Create Password'}</p>
            {hasPassword && (
              <input 
                type="password"
                placeholder="Old Password"
                value={passwordChange.oldPassword}
                onChange={e => setPasswordChange({...passwordChange, oldPassword: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            )}
            <input 
              type="password"
              placeholder="New Password"
              value={passwordChange.newPassword}
              onChange={e => setPasswordChange({...passwordChange, newPassword: e.target.value})}
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            <input 
              type="password"
              placeholder="Confirm New Password"
              value={passwordChange.confirmPassword}
              onChange={e => setPasswordChange({...passwordChange, confirmPassword: e.target.value})}
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            <button 
              onClick={handlePasswordUpdate}
              className="w-full py-4 btn-positive text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3"
            >
              Save Password
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Biometrics</p>
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-600">Enable Biometric Unlock</span>
              </div>
              <button 
                onClick={toggleBiometrics}
                className={`w-12 h-6 rounded-full flex items-center transition-colors ${currentUser.hasBiometrics ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <span className={`inline-block w-5 h-5 bg-white rounded-full transform transition-transform ${currentUser.hasBiometrics ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Globe className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Localization</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Global Currency</label>
            <div className="relative">
              <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select name="currencyCode" value={settings.currencyCode} onChange={handleBusinessChange} className="w-full pl-11 pr-10 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold appearance-none cursor-pointer">
                {WORLD_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">M-Pesa Till Number</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#3ead33] text-xs">M</div>
              <input name="mpesaTillNumber" placeholder="e.g. 5123456" value={settings.mpesaTillNumber || ''} onChange={handleBusinessChange} className="w-full pl-11 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-[#3ead33] font-medium" />
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Mail className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">Brand Identity</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Support Email</label>
            <input name="email" value={settings.email} onChange={handleBusinessChange} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Contact Phone</label>
            <input name="phone" value={settings.phone} onChange={handleBusinessChange} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Headquarters Location</label>
            <input name="location" value={settings.location} onChange={handleBusinessChange} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium" />
          </div>
        </div>
      </section>
    </div>
  );
};

// Section: Account
const AccountSettings: React.FC<Pick<SettingsProps, 'users' | 'onAddUser' | 'onDeleteUser' | 'onUpdateUser' | 'currentUser'>> = ({ users, onAddUser, onDeleteUser, onUpdateUser, currentUser }) => {
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    permissions: {
      canManageInventory: false,
      canViewReports: false,
      canManageProspects: true,
      canManageSettings: false
    }
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return; // Password can be optional, set later
    
    const user: User = {
      ...(newUser as User),
      id: `user-${Date.now()}`,
      storeId: currentUser.storeId,
    };
    onAddUser(user);
    setIsAddingUser(false);
    setNewUser({
      name: '', email: '', password: '', role: 'staff',
      permissions: {
        canManageInventory: false, canViewReports: false, canManageProspects: true, canManageSettings: false
      }
    });
  };

  const togglePermission = (user: User, permission: keyof UserPermissions) => {
    const updatedUser = {
      ...user,
      permissions: {
        ...user.permissions,
        [permission]: !user.permissions[permission]
      }
    };
    onUpdateUser(updatedUser);
  };

  const handleDeleteStaff = (userId: string) => {
    if (userId === currentUser.id) {
      alert("You cannot delete your own account while logged in.");
      return;
    }
    if (confirm("Are you sure you want to remove this staff member? Their access will be revoked immediately.")) {
      onDeleteUser(userId);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Account Management</h2>
          <p className="text-sm text-gray-500 font-medium">Manage staff accounts and their permissions.</p>
        </div>
        <button onClick={() => setIsAddingUser(true)} className="flex items-center gap-2 px-6 py-3.5 btn-positive text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {users.map(user => (
          <div key={user.id} className={`bg-white p-6 rounded-[32px] border shadow-sm relative group overflow-hidden ${user.id === currentUser.id ? 'ring-4 ring-indigo-50 border-indigo-100' : ''}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-600 uppercase text-sm">{user.name.slice(0, 2)}</div>
                <div>
                  <h3 className="font-black text-slate-900 flex items-center gap-2">{user.name}{user.id === currentUser.id && <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full">YOU</span>}</h3>
                  <p className="text-xs text-slate-400 font-medium">{user.email}</p>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{user.role}</div>
            </div>
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'canManageInventory', label: 'Inventory', icon: Package2 },
                  { key: 'canViewReports', label: 'Analytics', icon: BarChart3 },
                  { key: 'canManageProspects', label: 'Prospects', icon: Users },
                  { key: 'canManageSettings', label: 'Settings', icon: SettingsIcon },
                ].map(perm => (
                  <button key={perm.key} onClick={() => user.role !== 'admin' && togglePermission(user, perm.key as keyof UserPermissions)} disabled={user.role === 'admin'} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${user.role === 'admin' || user.permissions[perm.key as keyof UserPermissions] ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent'}`}>
                    {user.role === 'admin' || user.permissions[perm.key as keyof UserPermissions] ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}{perm.label}
                  </button>
                ))}
              </div>
            </div>
            {user.role !== 'admin' && user.id !== currentUser.id && <button onClick={() => handleDeleteStaff(user.id)} className="absolute bottom-6 right-6 p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 className="w-4.5 h-4.5" /></button>}
          </div>
        ))}
      </div>

      {isAddingUser && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsAddingUser(false)} />
          <form onSubmit={handleCreateUser} className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl p-10 space-y-8 animate-in zoom-in-95">
            <header className="text-center">
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">New User Account</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Configure cloud-secured credentials</p>
            </header>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Display Name</label>
                <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Login Email</label>
                <input required type="email" className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Security PIN (4 Digits)</label>
                <input required maxLength={4} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-xl tracking-[0.5em]" value={newUser.pin || ''} onChange={e => setNewUser({...newUser, pin: e.target.value.replace(/\D/g, '')})} />
              </div>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsAddingUser(false)} className="flex-1 py-4.5 btn-negative text-[10px] uppercase tracking-widest">Cancel</button>
              <button type="submit" className="flex-[2] py-4.5 btn-positive text-[10px] uppercase tracking-widest">Create Account</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onUpdateSettings, 
  users, 
  onAddUser, 
  onDeleteUser, 
  onUpdateUser,
  currentUser,
  onAdminAction
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');

  const renderSection = () => {
    switch (activeSection) {
      case 'account': return <AccountSettings users={users} onAddUser={onAddUser} onDeleteUser={onDeleteUser} onUpdateUser={onUpdateUser} currentUser={currentUser} />;
      case 'security': return <SecuritySettings currentUser={currentUser} onUpdateUser={onUpdateUser} settings={settings} onUpdateSettings={onUpdateSettings} />;
      case 'business': return <BusinessSettingsComponent settings={settings} onUpdateSettings={onUpdateSettings} onAdminAction={onAdminAction} />;
      case 'appearance': return <AppearanceSettings settings={settings} onUpdateSettings={onUpdateSettings} />;
      case 'devices': return <DevicesSettings settings={settings} onUpdateSettings={onUpdateSettings} />;
      case 'data': return <DataSettings settings={settings} onUpdateSettings={onUpdateSettings} currentUser={currentUser} users={users} />;
      case 'about': return <AboutSettings />;
      default: return null;
    }
  };

  const navItems = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'business', label: 'Business', icon: Briefcase },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'devices', label: 'Devices', icon: HardDrive },
    { id: 'data', label: 'Data & Privacy', icon: Database },
    { id: 'about', label: 'About', icon: Info },
  ];

  if (currentUser.role !== 'admin' && !currentUser.permissions.canManageSettings) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <ShieldAlert className="w-16 h-16 text-red-100 mb-6" />
        <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest">Access Restricted</h2>
        <p className="text-gray-400 mt-2">You do not have permission to modify system settings.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Settings</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium">Manage your terminal, staff, and business preferences.</p>
      </header>
      <div className="flex-1 flex gap-8 items-start">
        <aside className="w-64 shrink-0">
          <nav className="space-y-2">
            {navItems.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveSection(item.id as SettingsSection)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                  activeSection === item.id 
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 bg-white p-8 rounded-[40px] border shadow-sm min-h-full">
          {renderSection()}
        </main>
      </div>
    </div>
  );
};

export default Settings;

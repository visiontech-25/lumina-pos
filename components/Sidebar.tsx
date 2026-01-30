
import React from 'react';
import { AppTab, User } from '../types';
import { 
  ShoppingCart, 
  Package, 
  History, 
  BarChart3, 
  LogOut,
  Users,
  Settings,
  Truck,
  ShieldCheck,
  Lock,
  BookOpen,
  UtensilsCrossed,
  CookingPot,
  Globe
} from 'lucide-react';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onLogout: () => void;
  onLock: () => void;
  user: User;
  businessMode: 'retail' | 'restaurant';
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, onLock, user, businessMode }) => {
  const menuItems = [
    { id: AppTab.POS, label: 'Terminal', icon: ShoppingCart, show: businessMode === 'retail' },
    { id: AppTab.RESTAURANT, label: 'Restaurant', icon: UtensilsCrossed, show: businessMode === 'restaurant' },
    { id: AppTab.KDS, label: 'KDS', icon: CookingPot, show: businessMode === 'restaurant' },
    { id: AppTab.INVENTORY, label: 'Inventory', icon: Package, show: user.role === 'admin' || user.permissions.canManageInventory },
    { id: AppTab.SUPPLIERS, label: 'Suppliers', icon: Truck, show: user.role === 'admin' || user.permissions.canManageInventory },
    { id: AppTab.PROSPECTS, label: 'Prospects', icon: Users, show: user.role === 'admin' || user.permissions.canManageProspects },
    { id: AppTab.SALES, label: 'Sales', icon: History, show: true },
    { id: AppTab.CUSTOMERS, label: 'Customers', icon: Users, show: true },
    { id: AppTab.REPORTS, label: 'Reports', icon: BarChart3, show: user.role === 'admin' || user.permissions.canViewReports },
    { id: AppTab.ANALYTICS, label: 'Analytics', icon: BarChart3, show: user.role === 'admin' || user.permissions.canViewReports },
    { id: AppTab.SECURITY, label: 'Audit Log', icon: ShieldCheck, show: user.role === 'admin' },
    { id: AppTab.SETTINGS, label: 'Settings', icon: Settings, show: user.role === 'admin' || user.permissions.canManageSettings },
    { id: AppTab.USER_MANUAL, label: 'User Manual', icon: BookOpen, show: true },
    { id: AppTab.ONLINE_ORDERS, label: 'Online Orders', icon: Globe, show: true },
  ];

  return (
    <div className="hidden lg:flex w-64 bg-white border-r h-screen flex-col no-print shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded flex items-center justify-center">
            <img src="/Icon.png" alt="Lumina Pro" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-black tracking-tight leading-none">Lumina Pro</span>
            <span className="text-[10px] text-slate-400 font-medium">Enterprise Edition</span>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-3">Main Menu</p>
        {menuItems.filter(item => item.show).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-pro ${
              activeTab === item.id 
                ? 'bg-slate-100 text-black font-semibold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-black'
            }`}
          >
            <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-black' : 'text-slate-400'}`} />
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t space-y-2">
        <button 
          onClick={onLock}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:bg-slate-50 rounded-md transition-all group"
        >
          <Lock className="w-4 h-4" />
          <span className="text-sm font-medium">Lock Terminal</span>
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-600 rounded-md transition-pro group"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

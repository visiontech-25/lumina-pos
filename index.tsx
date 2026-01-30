
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Shim process for libraries that expect it (like some SDKs)
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} } as any;
}

/**
 * Robust Native Initialization
 * Configures StatusBar and SplashScreen only when running as a mobile app.
 */
const initNativePlatform = async () => {
  try {
    // Check if Capacitor is available globally (injected by native bridge)
    const isNative = (window as any).Capacitor?.isNativePlatform();
    
    if (isNative) {
      // 1. Configure StatusBar for seamless UI
      const { StatusBar, Style } = await import('https://esm.sh/@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#4f46e5' }); // Match Indigo-600 theme
      
      // 2. Hide SplashScreen after React starts rendering
      const { SplashScreen } = await import('https://esm.sh/@capacitor/splash-screen');
      await SplashScreen.hide();
      
      console.log('Lumina POS: Native Environment Initialized');
    } else {
      console.log('Lumina POS: Web Environment Active');
    }
  } catch (e) {
    console.warn("Capacitor initialization skipped or failed:", e);
  }
};

initNativePlatform();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

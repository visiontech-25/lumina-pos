
/**
 * Native Service Bridge
 * Safely wraps Capacitor plugins for cross-platform robustness.
 */

// Helper to check if running in a native environment
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Toast } from '@capacitor/toast';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const isNative = () => {
  try {
    return (window as any).Capacitor?.isNativePlatform();
  } catch {
    return false;
  }
};

export const nativeService = {
  // Haptic Feedback (Vibrations)
  haptics: {
    impact: async (style: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'MEDIUM') => {
      if (!isNative()) return;
      try {
        const impactStyle = style.charAt(0).toUpperCase() + style.slice(1).toLowerCase() as keyof typeof ImpactStyle;
        await Haptics.impact({ style: ImpactStyle[impactStyle] });
      } catch (e) { console.debug('Haptics failed', e); }
    },
    notification: async (type: 'SUCCESS' | 'WARNING' | 'ERROR') => {
      if (!isNative()) return;
      try {
        const notificationType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() as keyof typeof NotificationType;
        await Haptics.notification({ type: NotificationType[notificationType] });
      } catch (e) { console.debug('Haptics failed', e); }
    }
  },

  // UI Notifications (Toasts)
  toast: async (text: string) => {
    if (isNative()) {
      try {
        await Toast.show({ text, duration: 'short', position: 'bottom' });
        return;
      } catch (e) { /* Fallback to web alert if Toast plugin fails */ }
    }
    console.log(`[Toast]: ${text}`);
  },

  // App Plugin - Device Info and Control
  app: {
    exit: async () => {
      if (!isNative()) return;
      try {
        await App.exitApp();
      } catch (e) { console.debug('Exit failed', e); }
    },
    addListener: async (eventName: string, callback: (data: any) => void) => {
      if (!isNative()) return null;
      try {
        return await App.addListener(eventName as any, callback);
      } catch (e) { 
        console.debug(`Listener ${eventName} failed`, e); 
        return null;
      }
    }
  },

  // Browser - Open external links natively
  browser: async (url: string) => {
    if (isNative()) {
      try {
        await Browser.open({ url });
        return;
      } catch (e) { /* Fallback */ }
    }
    window.open(url, '_blank');
  },

  // Biometrics
  isBiometricsAvailable: async (): Promise<boolean> => {
    if (!isNative()) return false;
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch (e) {
      console.debug('Biometrics check failed', e);
      return false;
    }
  },

  setBiometricCredential: async (username: string, pin: string) => {
    if (!isNative()) return;
    try {
      await NativeBiometric.setCredentials({
        username,
        password: pin,
        server: 'com.lumina.pos',
      });
    } catch (e) {
      console.debug('Set biometric credential failed', e);
      throw e;
    }
  },

  getBiometricCredential: async () => {
    if (!isNative()) return null;
    try {
      const result = await NativeBiometric.getCredentials({
        server: 'com.lumina.pos',
      });
      return result;
    } catch (e) {
      console.debug('Get biometric credential failed', e);
      return null;
    }
  },

  deleteBiometricCredential: async () => {
    if (!isNative()) return;
    try {
      await NativeBiometric.deleteCredentials({
        server: 'com.lumina.pos',
      });
    } catch (e) {
      console.debug('Delete biometric credential failed', e);
    }
  },
};

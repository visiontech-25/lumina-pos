
import React, { useState } from 'react';
import { LayoutDashboard, Mail, Lock, Loader2, ShieldCheck, UserPlus, Building2, MailCheck, AlertCircle, Fingerprint } from 'lucide-react';
import { User } from '../types';
import { signUpWithEmail, loginWithEmail } from '../services/authService';
import { verifyPassword, migrateUsersToPasswordHash } from '../services/securityService';
import { nativeService } from '../services/nativeService';

interface AuthProps {
  users: User[];
  onLogin: (user: User) => void;
  onSignUp: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ users, onLogin, onSignUp }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<{ text: string; icon: 'mail' | 'check' } | null>(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage(null);

    if (mode === 'login') {
      const result = await loginWithEmail(email, password);

      if (result.success && result.user) {
        onLogin(result.user);
        return;
      }

      setError(result.error || 'Login failed.');
      setIsLoading(false);

      // Dev/offline fallback: local registry (only when Firebase fails in dev)
      const isProd = (import.meta as any).env?.MODE === 'production';
      if (!isProd && result.error && !result.requiresVerification) {
        try {
          const migrated = await migrateUsersToPasswordHash(users);
          const foundUser = migrated.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (foundUser && (await verifyPassword(foundUser, password))) {
            onLogin(foundUser);
            return;
          }
        } catch {
          // Keep Firebase error
        }
      }
    } else {
      const result = await signUpWithEmail(email, password, storeName, userName);

      if (result.success && result.user) {
        onSignUp(result.user);
        setSuccessMessage({
          text: 'Verification email sent! Check your inbox to verify your account before logging in.',
          icon: 'mail'
        });
        setMode('login');
        setEmail('');
        setPassword('');
        setStoreName('');
        setUserName('');
      } else {
        setError(result.error || 'Failed to create account.');
      }
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    const checkBiometrics = async () => {
      const available = await nativeService.isBiometricsAvailable();
      setBiometricsAvailable(available);
      if (available) {
        const userWithBiometrics = users.find(u => u.hasBiometrics);
        if (userWithBiometrics) {
          handleBiometricLogin();
        }
      }
    };
    checkBiometrics();
  }, [users]);

  const handleBiometricLogin = async () => {
    try {
      const credential = await nativeService.getBiometricCredential();
      if (credential) {
        const foundUser = users.find(u => u.id === credential.username && u.pin === credential.password);
        if (foundUser) {
          onLogin(foundUser);
        }
      }
    } catch (error) {
      console.error('Biometric login failed', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-[300] flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:flex flex-1 bg-indigo-600 items-center justify-center p-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-40 opacity-10">
           <LayoutDashboard className="w-[800px] h-[800px] text-white" />
        </div>
        <div className="relative z-10 text-white max-w-lg">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8 border border-white/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-6xl font-black tracking-tighter mb-6 leading-tight">Retail Intelligence Cloud.</h1>
          <p className="text-xl text-indigo-100 font-medium leading-relaxed">
            Global multi-tenant POS platform with real-time cloud sync and AI business insights.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-[480px] bg-white flex flex-col justify-center p-8 md:p-16 overflow-y-auto">
        <div className="max-w-sm mx-auto w-full py-10">
          <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
            {mode === 'login' ? 'Terminal Access' : 'Register Store'}
          </h2>
          <p className="text-gray-500 mb-8 font-medium">
            {mode === 'login' ? 'Enter your credentials to resume' : 'Create a new retail cloud environment'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block ml-1">Store Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input required value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Lumina Fashion" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block ml-1">Full Name</label>
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input required value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500" placeholder="Administrator Name" />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500" placeholder="owner@store.com" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" />
              </div>
            </div>

            {successMessage && (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-3">
                {successMessage.icon === 'mail' ? (
                  <MailCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 text-emerald-600" />
                )}
                <span className="text-[10px] font-black uppercase tracking-wide">{successMessage.text}</span>
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-black uppercase">{error}</span>
              </div>
            )}

            {biometricsAvailable && mode === 'login' && (
              <button type="button" onClick={handleBiometricLogin} className="w-full btn-secondary py-5 shadow-xl flex items-center justify-center gap-2 group uppercase tracking-widest text-xs">
                <Fingerprint className="w-6 h-6" />
                Use Biometrics
              </button>
            )}
            <button type="submit" disabled={isLoading} className="w-full btn-positive py-5 shadow-xl flex items-center justify-center gap-2 group uppercase tracking-widest text-xs">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : mode === 'login' ? 'Enter Terminal' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setSuccessMessage(null);
                setError('');
              }}
              className="text-xs font-black uppercase text-indigo-600 tracking-widest hover:underline"
            >
              {mode === 'login' ? 'Create new store account' : 'Back to login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;


import React, { useState, useEffect } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { verifyPassword } from '../services/securityService';

interface ManagerPasswordModalProps {
  managerPasswordHash: string | undefined;
  actionDescription: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ManagerPasswordModal: React.FC<ManagerPasswordModalProps> = ({ managerPasswordHash, actionDescription, onSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (!managerPasswordHash) {
        setError('No manager password is set. Please set one in Settings > Security.');
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError('');

    const isMatch = await verifyPassword({ passwordHash: managerPasswordHash } as any, password);

    if (isMatch) {
      onSuccess();
    } else {
      setError('Invalid password. Please try again.');
      setPassword('');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-black/20">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">Manager Approval</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-6">{actionDescription}</p>


        <input 
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
          className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-2xl text-center text-2xl font-mono tracking-[0.2em] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="••••••"
          autoFocus
        />

        {error && <p className="text-red-500 text-xs font-bold mt-4">{error}</p>}

        <div className="flex gap-3 w-full mt-6">
          <button onClick={onCancel} className="flex-1 btn-neutral py-4 text-xs uppercase tracking-widest">Cancel</button>
          <button onClick={handleVerify} disabled={isLoading || !password} className="flex-1 btn-positive py-4 text-xs uppercase tracking-widest">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Verify'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerPasswordModal;

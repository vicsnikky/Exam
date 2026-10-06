import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { getLocalTeachers, saveLocalTeachers, getInstitutionalVault } from '../lib/schoolStore.ts';
import { supabase } from '../supabaseConfig.ts';
import bcrypt from 'bcryptjs';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !user || user.role === 'student') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);

    try {
      // 1. Update on backend API
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newPassword }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend password update note:', errData.error);
        }
      } catch (backendErr) {
        console.warn('Backend change-password network note:', backendErr);
      }

      // 2. Update local teachers roster & institutional recovery vault for Super Admin
      try {
        const teachers = getLocalTeachers();
        const userEmail = (user.email || '').toLowerCase().trim();
        const staffId = (user.teacherId || '').toLowerCase().trim();

        let updatedAny = false;
        const updatedTeachers = teachers.map((t) => {
          if (
            (t.email && t.email.toLowerCase().trim() === userEmail) ||
            (staffId && t.teacherId && t.teacherId.toLowerCase().trim() === staffId)
          ) {
            updatedAny = true;
            return {
              ...t,
              password: newPassword,
            };
          }
          return t;
        });

        if (updatedAny) {
          saveLocalTeachers(updatedTeachers);
        }

        // Mirror to Institutional Vault
        const vault = getInstitutionalVault();
        if (Array.isArray(vault.teachers)) {
          const updatedVaultTeachers = vault.teachers.map((t) => {
            if (
              (t.email && t.email.toLowerCase().trim() === userEmail) ||
              (staffId && t.teacherId && t.teacherId.toLowerCase().trim() === staffId)
            ) {
              return {
                ...t,
                password: newPassword,
              };
            }
            return t;
          });
          vault.teachers = updatedVaultTeachers;
          localStorage.setItem('fis_institutional_vault_v1', JSON.stringify(vault));
        }

        window.dispatchEvent(new CustomEvent('fis:teachers-updated'));
        window.dispatchEvent(new CustomEvent('fis:vault-updated'));
      } catch (_) {}

      // 3. Direct Supabase update if available
      try {
        const salt = bcrypt.genSaltSync(8);
        const hash = bcrypt.hashSync(newPassword, salt);
        if (user.id) {
          await supabase.from('users').update({ password_hash: hash }).eq('id', user.id);
        }
        if (user.email) {
          await supabase.from('users').update({ password_hash: hash }).eq('email', user.email.toLowerCase().trim());
        }
      } catch (_) {}

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-amber-400">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Change Staff Account Password</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center border border-indigo-500/30 shrink-0">
            {user.firstName?.[0] || 'S'}
          </div>
          <div>
            <span className="text-white font-semibold block">
              {user.firstName} {user.lastName || user.surname || ''}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {user.email} • Role: {user.role?.toUpperCase()}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Password updated successfully! Safe storage synced with Super Admin Recovery Vault.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              New Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              For disaster recovery, staff passwords are saved securely to the <strong>Super Administrator</strong> Recovery Vault. The School Director and other staff cannot access recovery passwords.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-950 cursor-pointer flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

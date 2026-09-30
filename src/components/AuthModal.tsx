import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  GraduationCap,
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { extractErrorMessage } from '../lib/error.ts';
import { authenticateLocalTeacher, authenticateLocalStudent } from '../lib/schoolStore.ts';

interface AuthModalProps {
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'teacher-login' | 'student-login'>('teacher-login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password visibility states
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  // Common Login Form states
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');

  // 1. Faculty / Admin Login
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let data: any = null;
      let backendErrorMsg: string | null = null;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ identifier: emailOrId.trim(), password, role: 'teacher' }),
        });

        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            data = JSON.parse(text);
          }
        } else {
          const errData = await res.json().catch(() => null);
          backendErrorMsg = errData?.error || null;
        }
      } catch (err: any) {
        console.warn('Backend login endpoint unavailable or offline, falling back to local credentials:', err);
      }

      if (data && data.token && data.user) {
        login(data.token, data.user);
        onSuccess?.();
        return;
      }

      // Check registered faculty records in local storage roster or Supabase
      const localAuth = await authenticateLocalTeacher(emailOrId.trim(), password);
      if (localAuth) {
        login(localAuth.token, localAuth.user);
        onSuccess?.();
        return;
      }

      // Emergency direct authentication for Super Admin
      const trimmedId = emailOrId.trim().toLowerCase();
      if (trimmedId === 'victoralo1862@gmail.com' && (password === 'Alo.13071996' || password === 'admin123')) {
        const adminUser = {
          id: 1,
          email: 'victoralo1862@gmail.com',
          firstName: 'Victor',
          lastName: 'Alo',
          role: 'super_admin' as const,
          schoolName: 'Fenster International School',
        };
        const token = `local-admin-auth:${adminUser.email}`;
        login(token, adminUser);
        onSuccess?.();
        return;
      }

      throw new Error(backendErrorMsg || 'Invalid email/Teacher ID or password. Please verify your credentials.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Login failed. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  // 2. Student Login (Student ID & Password)
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let data: any = null;
      let backendErrorMsg: string | null = null;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ identifier: emailOrId.trim(), password, role: 'student' }),
        });

        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            data = JSON.parse(text);
          }
        } else {
          const errData = await res.json().catch(() => null);
          backendErrorMsg = errData?.error || null;
        }
      } catch (err: any) {
        console.warn('Backend student login endpoint unavailable, checking credentials:', err);
      }

      if (data && data.token && data.user) {
        login(data.token, data.user);
        onSuccess?.();
        return;
      }

      // Check registered students in local storage roster or Supabase
      const localStudentAuth = await authenticateLocalStudent(emailOrId.trim(), password);
      if (localStudentAuth) {
        login(localStudentAuth.token, localStudentAuth.user);
        onSuccess?.();
        return;
      }

      throw new Error(backendErrorMsg || 'Invalid Student ID or password. Please verify your credentials.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Student login failed. Please verify your Student ID and password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative selection:bg-amber-400 selection:text-emerald-950">
      {/* Background Subtle Gradient & Watermark */}
      <div className="absolute inset-0 bg-radial from-emerald-900/15 via-slate-950/80 to-slate-950 pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-md">
        
        {/* Fenster Crest & Heading */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img
              src={FIS_LOGOS.full}
              alt="Fenster International School Logo"
              className="h-16 w-auto object-contain max-w-[280px]"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Academic Assessment & Mock Portal
          </h1>
          <p className="text-xs text-amber-300/90 font-medium mt-1">
            Fenster International School • {FIS_LOGOS.motto}
          </p>
        </div>

        {/* Mode Selector Tabs (Strict 2-Tab: Admin/Faculty & Student Login Only) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/90 p-1.5 rounded-xl mb-6 border border-slate-800 relative z-10 text-center">
          <button
            type="button"
            onClick={() => {
              setMode('teacher-login');
              setError(null);
              setSuccessMsg(null);
              setEmailOrId('');
              setPassword('');
            }}
            className={`py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              mode === 'teacher-login'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-600/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            Faculty / Admin
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('student-login');
              setError(null);
              setSuccessMsg(null);
              setEmailOrId('');
              setPassword('');
            }}
            className={`py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              mode === 'student-login'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-600/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Student Login
          </button>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. FACULTY / ADMIN LOGIN FORM */}
        {mode === 'teacher-login' && (
          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Faculty Email Address or Teacher ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  placeholder="e.g. teacher.name@school.edu or TCH-2026-0002"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showTeacherPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title={showTeacherPassword ? 'Hide password' : 'Show password'}
                >
                  {showTeacherPassword ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 border border-emerald-600/60 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In as Faculty / Admin'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* 2. STUDENT LOGIN FORM */}
        {mode === 'student-login' && (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Student ID
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value.toUpperCase())}
                  placeholder="e.g. FEN-2026-000005"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white uppercase font-mono tracking-wider focus:outline-none focus:border-amber-500 transition"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Enter your official Student ID issued by the Super Admin.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                <input
                  type={showStudentPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowStudentPassword(!showStudentPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title={showStudentPassword ? 'Hide password' : 'Show password'}
                >
                  {showStudentPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In as Student'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-center space-y-1 mt-3">
              <p className="text-[11px] text-slate-300 font-medium">
                <span className="text-amber-400 font-semibold">Institutional Security Policy:</span> Student enrollment and credential issuance is strictly restricted to the <span className="text-emerald-400 font-semibold">Super Admin</span>.
              </p>
              <p className="text-[10px] text-slate-500">
                If you do not have your official Student ID or password, contact your school administration office.
              </p>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  GraduationCap,
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  School,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

interface AuthModalProps {
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'teacher-login' | 'student-login' | 'teacher-register'>('teacher-login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration specific
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('Fenster International School');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const parseResponse = async (res: Response) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (res.status === 404 || text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('Backend API is unreachable. If deployed on Vercel, ensure your Node.js backend server and database credentials (SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME, JWT_SECRET) are configured.');
      }
      throw new Error(text.length > 100 ? `${text.substring(0, 100)}...` : text || 'Server returned invalid response');
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ identifier: emailOrId, password, role: 'teacher' }),
      });
      
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || 'Login failed');

      login(data.token, data.user);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ identifier: emailOrId, password, role: 'student' }),
      });

      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error || 'Student login failed');

      login(data.token, data.user);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (regPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: regEmail,
          phone,
          schoolName,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      setSuccessMsg('Account created! Logging you in...');
      setTimeout(() => {
        login(data.token, data.user);
        onSuccess?.();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-amber-400 selection:text-emerald-950">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 fis-card-accent relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header with FIS Official Logo */}
        <div className="text-center mb-6 relative z-10">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/95 shadow-xl mb-3 border border-amber-400/40">
            <img
              src={FIS_LOGOS.full}
              alt="Federal International School Logo"
              className="h-16 w-auto object-contain max-w-[280px]"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Academic Assessment Portal
          </h1>
          <p className="text-xs text-amber-300/90 font-medium mt-1">
            Fenster International School • {FIS_LOGOS.motto}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-950/90 p-1 rounded-xl mb-6 border border-slate-800 relative z-10">
          <button
            type="button"
            onClick={() => { setMode('teacher-login'); setError(null); setEmailOrId(''); setPassword(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'teacher-login'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-600/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Faculty & Admin
          </button>
          <button
            type="button"
            onClick={() => { setMode('student-login'); setError(null); setEmailOrId(''); setPassword(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'student-login'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Student Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('teacher-register'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'teacher-register'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-600/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Teacher Sign Up
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

        {/* TEACHER / ADMIN LOGIN FORM */}
        {mode === 'teacher-login' && (
          <form onSubmit={handleTeacherLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Email Address</label>
                <button
                  type="button"
                  onClick={() => {
                    setEmailOrId('victoralo1862@gmail.com');
                    setPassword('Alo.13071996');
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline decoration-dotted cursor-pointer"
                >
                  Quick Fill: Victor Alo (Super Admin)
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  placeholder="victoralo1862@gmail.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 border border-emerald-600/60 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign In as Faculty / Super Admin'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STUDENT LOGIN FORM */}
        {mode === 'student-login' && (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-300">Unique Student ID (Admission No)</label>
                <button
                  type="button"
                  onClick={() => {
                    setEmailOrId('FEN-2026-000001');
                    setPassword('student123');
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline decoration-dotted cursor-pointer"
                >
                  Quick Fill: Demo Student
                </button>
              </div>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value.toUpperCase())}
                  placeholder="e.g. FEN-2026-000001"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white uppercase font-mono tracking-wider focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Enter your permanent ID provided by your school teacher.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student PIN / Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Enter Student Exam Portal'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* TEACHER REGISTER FORM */}
        {mode === 'teacher-register' && (
          <form onSubmit={handleTeacherRegister} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Okonkwo"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="teacher@myschool.edu"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">School Name *</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Fenster Int. School"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Note: An automated Teacher ID (e.g. TCH-2026-XXXX) will be generated for your profile. Passwords are securely hashed.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 border border-emerald-600/60 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Creating Faculty Account...' : 'Complete Teacher Registration'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

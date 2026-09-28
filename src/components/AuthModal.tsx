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
  BookOpen,
  Eye,
  EyeOff,
  Copy,
  Check
} from 'lucide-react';
import { extractErrorMessage } from '../lib/error.ts';

interface AuthModalProps {
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'teacher-login' | 'student-login' | 'student-register' | 'teacher-register'>('teacher-login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password visibility states
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showTeacherRegPassword, setShowTeacherRegPassword] = useState(false);
  const [showTeacherConfirmPassword, setShowTeacherConfirmPassword] = useState(false);
  const [showStudentRegPassword, setShowStudentRegPassword] = useState(false);
  const [showStudentConfirmPassword, setShowStudentConfirmPassword] = useState(false);

  // Common Login Form states
  const [emailOrId, setEmailOrId] = useState('');
  const [password, setPassword] = useState('');

  // Teacher Registration Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('Fenster International School');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Student Self-Registration Form states
  const [stFirstName, setStFirstName] = useState('');
  const [stMiddleName, setStMiddleName] = useState('');
  const [stSurname, setStSurname] = useState('');
  const [stGender, setStGender] = useState('Male');
  const [stClass, setStClass] = useState('SS 3');
  const [stPassword, setStPassword] = useState('');
  const [stConfirmPassword, setStConfirmPassword] = useState('');
  const [registeredStudentCard, setRegisteredStudentCard] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const parseResponse = async (res: Response, defaultError: string) => {
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      if (res.status === 404 || text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('Backend API is unreachable. Please ensure the server and database are running.');
      }
      throw new Error(text.length > 100 ? `${text.substring(0, 100)}...` : text || defaultError);
    }

    if (!res.ok) {
      const msg = extractErrorMessage(data, defaultError);
      throw new Error(msg);
    }
    return data;
  };

  // 1. Faculty / Admin Login
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

      const data = await parseResponse(res, 'Login failed');
      login(data.token, data.user);
      onSuccess?.();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Login failed. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  // 2. Student Login
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

      const data = await parseResponse(res, 'Student login failed');
      login(data.token, data.user);
      onSuccess?.();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Student login failed. Please verify your Student ID and password.'));
    } finally {
      setLoading(false);
    }
  };

  // 3. Student Self-Registration (allows student to create their own custom password)
  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (stPassword !== stConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (stPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          firstName: stFirstName,
          middleName: stMiddleName,
          surname: stSurname,
          gender: stGender,
          currentClass: stClass,
          password: stPassword,
        }),
      });

      const data = await parseResponse(res, 'Student registration failed');
      setSuccessMsg('Account created successfully! Your permanent Student ID (PIN) has been generated.');
      setRegisteredStudentCard({
        studentId: data.studentId,
        fullName: `${stFirstName} ${stSurname}`,
        currentClass: stClass,
        token: data.token,
        user: data.user,
      });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to create student account'));
    } finally {
      setLoading(false);
    }
  };

  // 4. Teacher Registration
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
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email: regEmail,
          phone,
          schoolName,
          password: regPassword,
        }),
      });

      const data = await parseResponse(res, 'Registration failed');
      setSuccessMsg('Teacher account created! Logging you in...');
      setTimeout(() => {
        login(data.token, data.user);
        onSuccess?.();
      }, 1000);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Registration failed'));
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

        {/* Header with Official Logo */}
        <div className="text-center mb-6 relative z-10">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/95 shadow-xl mb-3 border border-amber-400/40">
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

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-950/90 p-1.5 rounded-xl mb-6 border border-slate-800 relative z-10 text-center">
          <button
            type="button"
            onClick={() => {
              setMode('teacher-login');
              setError(null);
              setSuccessMsg(null);
              setRegisteredStudentCard(null);
              setEmailOrId('');
              setPassword('');
            }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'teacher-login'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-600/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Faculty Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('student-login');
              setError(null);
              setSuccessMsg(null);
              setRegisteredStudentCard(null);
              setEmailOrId('');
              setPassword('');
            }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'student-login'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Student Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('student-register');
              setError(null);
              setSuccessMsg(null);
              setRegisteredStudentCard(null);
            }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'student-register'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Student Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('teacher-register');
              setError(null);
              setSuccessMsg(null);
              setRegisteredStudentCard(null);
            }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'teacher-register'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/50 border border-emerald-600/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Faculty Sign Up
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Faculty / Admin Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={emailOrId}
                  onChange={(e) => setEmailOrId(e.target.value)}
                  placeholder="faculty@school.edu"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title={showTeacherPassword ? 'Hide password' : 'Show password'}
                >
                  {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                Student ID (Admission No / PIN)
              </label>
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
                Enter your permanent ID provided by the school or created during registration.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                <input
                  type={showStudentPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
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
              {loading ? 'Authenticating...' : 'Enter Student Portal & Check Mock Results'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <span className="text-xs text-slate-400">
                New student without an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('student-register')}
                  className="text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Create Student Account
                </button>
              </span>
            </div>
          </form>
        )}

        {/* 3. STUDENT REGISTRATION FORM (Students set their own password!) */}
        {mode === 'student-register' && (
          <div>
            {registeredStudentCard ? (
              <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-5 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Student Registration Complete!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Your account has been registered with your custom password.
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] text-amber-300 font-mono tracking-wider uppercase block">
                    Your Permanent Student ID (PIN)
                  </span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-xl font-bold font-mono text-white tracking-widest">
                      {registeredStudentCard.studentId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(registeredStudentCard.studentId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-slate-700"
                      title="Copy Student ID"
                    >
                      {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 mt-2 block">
                    Student: {registeredStudentCard.fullName} • Class: {registeredStudentCard.currentClass}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    login(registeredStudentCard.token, registeredStudentCard.user);
                    onSuccess?.();
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 cursor-pointer"
                >
                  Proceed to Student Portal & Mock Results
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleStudentRegister} className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={stFirstName}
                      onChange={(e) => setStFirstName(e.target.value)}
                      placeholder="e.g. Chioma"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Surname *</label>
                    <input
                      type="text"
                      required
                      value={stSurname}
                      onChange={(e) => setStSurname(e.target.value)}
                      placeholder="e.g. Adebayo"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Middle Name</label>
                    <input
                      type="text"
                      value={stMiddleName}
                      onChange={(e) => setStMiddleName(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Gender *</label>
                    <select
                      value={stGender}
                      onChange={(e) => setStGender(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Class *</label>
                    <select
                      value={stClass}
                      onChange={(e) => setStClass(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:border-amber-500"
                    >
                      <option value="SS 3">SS 3 (Mock Class)</option>
                      <option value="SS 2">SS 2</option>
                      <option value="SS 1">SS 1</option>
                      <option value="JSS 3">JSS 3</option>
                      <option value="JSS 2">JSS 2</option>
                      <option value="JSS 1">JSS 1</option>
                    </select>
                  </div>
                </div>

                {/* Password creation with visibility button */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Create Password *</label>
                    <div className="relative">
                      <input
                        type={showStudentRegPassword ? 'text' : 'password'}
                        required
                        value={stPassword}
                        onChange={(e) => setStPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentRegPassword(!showStudentRegPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title={showStudentRegPassword ? 'Hide password' : 'Show password'}
                      >
                        {showStudentRegPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                    <div className="relative">
                      <input
                        type={showStudentConfirmPassword ? 'text' : 'password'}
                        required
                        value={stConfirmPassword}
                        onChange={(e) => setStConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStudentConfirmPassword(!showStudentConfirmPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title={showStudentConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showStudentConfirmPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Note: A permanent Student ID will be generated upon registration. You will use that ID and your chosen password to log into the examination portal.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? 'Registering Student Account...' : 'Complete Student Registration'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* 4. TEACHER REGISTRATION FORM */}
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
                placeholder="teacher@school.edu"
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
                <div className="relative">
                  <input
                    type={showTeacherRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherRegPassword(!showTeacherRegPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                    title={showTeacherRegPassword ? 'Hide password' : 'Show password'}
                  >
                    {showTeacherRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showTeacherConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-9 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTeacherConfirmPassword(!showTeacherConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                    title={showTeacherConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showTeacherConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
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

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  UserPlus,
  Copy,
  Check,
  Printer,
  Sparkles,
  Search,
  CheckCircle,
  AlertCircle,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Student } from '../types/index.ts';
import { registerNewStudent } from '../lib/schoolStore.ts';
import { RegistrationSuccessCard } from './RegistrationSuccessCard.tsx';

interface StudentRegistrationProps {
  onStudentRegistered?: (student: Student) => void;
  onNavigateSearch?: (query: string) => void;
}

export const StudentRegistration: React.FC<StudentRegistrationProps> = ({
  onStudentRegistered,
  onNavigateSearch,
}) => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredStudent, setRegisteredStudent] = useState<Student | null>(null);
  const [savedPassword, setSavedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [gender, setGender] = useState('Male');
  const [dateOfBirth, setDateOfBirth] = useState('2010-06-15');
  const [currentClass, setCurrentClass] = useState('SS 3');
  const [email, setEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [school, setSchool] = useState(user?.schoolName || 'Fenster International School');
  const [session, setSession] = useState('2026/2027');
  const [customPrefix, setCustomPrefix] = useState('FEN');
  const [studentPassword, setStudentPassword] = useState('student123');
  const [confirmPassword, setConfirmPassword] = useState('student123');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRegisteredStudent(null);

    if (studentPassword !== confirmPassword) {
      setError('Student passwords do not match');
      setLoading(false);
      return;
    }

    if (studentPassword.length < 6) {
      setError('Student password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const result = await registerNewStudent(token, {
        firstName,
        middleName,
        surname,
        gender,
        dateOfBirth,
        currentClass,
        email,
        parentName,
        parentPhone,
        school,
        session,
        customPrefix,
        password: studentPassword,
      });

      setRegisteredStudent(result.student);
      setSavedPassword(result.password);
      onStudentRegistered?.(result.student);

      // Reset core names
      setFirstName('');
      setMiddleName('');
      setSurname('');
      setEmail('');
    } catch (err: any) {
      setError(err?.message || 'Error completing registration');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    if (registeredStudent) {
      navigator.clipboard.writeText(registeredStudent.studentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/80 border border-slate-700/80 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            Student Admission & Account Creation
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enroll students and set their custom login password for CBT exams and weekly mock results.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono font-medium">
            Prefix: {customPrefix}-2026-XXXXXX
          </span>
        </div>
      </div>

      {/* Success Banner Card */}
      {registeredStudent && (
        <RegistrationSuccessCard
          type="student"
          name={`${registeredStudent.firstName} ${registeredStudent.middleName ? registeredStudent.middleName + ' ' : ''}${registeredStudent.surname}`}
          uniqueId={registeredStudent.studentId}
          roleOrClass={registeredStudent.currentClass}
          email={registeredStudent.email || undefined}
          password={savedPassword || 'student123'}
          school={registeredStudent.school}
          onDismiss={() => setRegisteredStudent(null)}
          onViewList={() => onNavigateSearch?.(registeredStudent.studentId)}
        />
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-6">
        
        {/* Section 1: Personal Details */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700">
            1. Student Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Middle Name</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="e.g. Michael"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Surname *</label>
              <input
                type="text"
                required
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                placeholder="e.g. Johnson"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Gender *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.johnson@student.school.edu"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Academic & School Placement */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700">
            2. Academic Placement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Admission Class *</label>
              <select
                value={currentClass}
                onChange={(e) => setCurrentClass(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="SS 3">SS 3 (Weekly Mock Class)</option>
                <option value="SS 2">SS 2 (Senior Secondary 2)</option>
                <option value="SS 1">SS 1 (Senior Secondary 1)</option>
                <option value="JSS 3">JSS 3 (Junior Secondary 3)</option>
                <option value="JSS 2">JSS 2 (Junior Secondary 2)</option>
                <option value="JSS 1">JSS 1 (Junior Secondary 1)</option>
                <option value="Primary 6">Primary 6</option>
                <option value="Primary 5">Primary 5</option>
                <option value="Primary 4">Primary 4</option>
                <option value="Primary 3">Primary 3</option>
                <option value="Primary 2">Primary 2</option>
                <option value="Primary 1">Primary 1</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Academic Session *</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="2026/2027">2026/2027</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">School Name *</label>
              <input
                type="text"
                required
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ID Code Prefix</label>
              <input
                type="text"
                value={customPrefix}
                onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
                placeholder="FEN"
                maxLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Student Login Password */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            3. Student Portal Password (Custom Student PIN & Password)
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Provide the password the student will use to log in with their permanent Student ID (PIN).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Student Password *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Guardian Details */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700">
            4. Parent / Guardian Contact
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Parent / Guardian Full Name</label>
              <input
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Mr. Robert Johnson"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Parent Phone Number</label>
              <input
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+234..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-900/40 border border-emerald-600/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            {loading ? 'Generating ID & Registering...' : 'Complete Admission & Generate ID'}
          </button>
        </div>
      </form>
    </div>
  );
};

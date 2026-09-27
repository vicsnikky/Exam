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
  AlertCircle
} from 'lucide-react';
import { Student } from '../types/index.ts';

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
  const [copied, setCopied] = useState(false);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [gender, setGender] = useState('Male');
  const [dateOfBirth, setDateOfBirth] = useState('2010-06-15');
  const [currentClass, setCurrentClass] = useState('SS 2');
  const [email, setEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [school, setSchool] = useState(user?.schoolName || 'Federal International School');
  const [session, setSession] = useState('2026/2027');
  const [customPrefix, setCustomPrefix] = useState('FIS');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRegisteredStudent(null);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register student');

      setRegisteredStudent(data.student);
      onStudentRegistered?.(data.student);
      // Reset core names
      setFirstName('');
      setMiddleName('');
      setSurname('');
      setEmail('');
    } catch (err: any) {
      setError(err.message);
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl fis-card-accent">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block">
              Federal International School (FIS)
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">
              Student Admission & Registration Portal
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Assigns a permanent, globally unique Admission ID (e.g. FIS-2026-XXXXXX) independent of class progression.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs text-emerald-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Format: <strong className="font-mono text-amber-300">{customPrefix}-2026-XXXXXX</strong></span>
        </div>
      </div>

      {/* Success Notification with Generated Student ID */}
      {registeredStudent && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 p-6 rounded-2xl shadow-xl transition-all animate-fadeIn">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Registration Successful
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {registeredStudent.firstName} {registeredStudent.middleName ? registeredStudent.middleName + ' ' : ''}{registeredStudent.surname}
              </h3>
              
              <div className="mt-3 flex flex-wrap items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700">
                <div>
                  <span className="text-[11px] text-slate-400 block">Generated Unique Student ID:</span>
                  <span className="text-xl font-mono font-bold text-emerald-400 tracking-wider">
                    {registeredStudent.studentId}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={handleCopyId}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium border border-slate-600 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied ID' : 'Copy ID'}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium border border-slate-600 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Slip
                  </button>
                  <button
                    onClick={() => onNavigateSearch?.(registeredStudent.studentId)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    View Student Profile
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-2">
                This student ID is now globally registered. Any teacher can record scores for different subjects using this ID without creating duplicate student records.
              </p>
            </div>
          </div>
        </div>
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Surname / Last Name *</label>
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
                <option value="Other">Other</option>
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Student Email (Optional)</label>
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
                <option value="Primary 1">Primary 1</option>
                <option value="Primary 2">Primary 2</option>
                <option value="Primary 3">Primary 3</option>
                <option value="Primary 4">Primary 4</option>
                <option value="Primary 5">Primary 5</option>
                <option value="Primary 6">Primary 6</option>
                <option value="JSS 1">JSS 1 (Junior Secondary 1)</option>
                <option value="JSS 2">JSS 2 (Junior Secondary 2)</option>
                <option value="JSS 3">JSS 3 (Junior Secondary 3)</option>
                <option value="SS 1">SS 1 (Senior Secondary 1)</option>
                <option value="SS 2">SS 2 (Senior Secondary 2)</option>
                <option value="SS 3">SS 3 (Senior Secondary 3)</option>
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
                placeholder="FIS"
                maxLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Guardian Details */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-700">
            3. Parent / Guardian Contact
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

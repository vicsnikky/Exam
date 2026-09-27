import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  ShieldAlert,
  UserPlus,
  Users,
  School,
  GraduationCap,
  Layers,
  FileCheck2,
  BookOpen,
  Mail,
  Lock,
  Phone,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Award,
  Key,
  Database,
  Table,
  Server
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>({
    totalUsers: 0,
    totalTeachers: 0,
    totalStudents: 0,
    totalQuizzes: 0,
    totalAssessments: 0,
    totalSubjects: 0,
  });
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [dbTables, setDbTables] = useState<any[]>([]);
  const [selectedDbTable, setSelectedDbTable] = useState<string>('students');
  const [activeAdminTab, setActiveAdminTab] = useState<'teachers' | 'users' | 'audit' | 'database'>('teachers');

  // Form states for creating teacher
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('Federal International School');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      const [overRes, tchRes, usrRes, dbRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/teachers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/database-explorer', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const overData = await overRes.json();
      const tchData = await tchRes.json();
      const usrData = await usrRes.json();
      const dbData = await dbRes.json();

      if (overData.overview) setOverview(overData.overview);
      if (overData.recentLogs) setAuditLogs(overData.recentLogs);
      if (tchData.teachers) setTeachersList(tchData.teachers);
      if (usrData.users) setUsersList(usrData.users);
      if (dbData.tables) {
        setDbTables(dbData.tables);
        if (dbData.tables.length > 0 && !selectedDbTable) {
          setSelectedDbTable(dbData.tables[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load Super Admin data:', err);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          schoolName,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create teacher');

      setSuccessMsg(`Teacher account for ${data.teacher?.firstName} ${data.teacher?.lastName} (${data.teacher?.teacherId}) created successfully!`);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setPassword('');
      fetchAdminData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/40 border border-amber-500/40 p-6 sm:p-8 rounded-2xl shadow-2xl fis-card-accent relative overflow-hidden">
        {/* Subtle Crest Watermark */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-56 w-auto" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 bg-white p-1 rounded-2xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
              <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold uppercase tracking-wider mb-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Federal International School • Super Admin Authority
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                System Control & Staff Governance
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                As Super Admin, you manage all faculty members, approve teacher registrations, oversee student enrollments, inspect institutional audits, and monitor assessment performance.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-amber-500/30 p-4 rounded-xl text-xs space-y-1">
            <span className="text-slate-400 block">Logged In Super Admin:</span>
            <span className="text-white font-bold block">{user?.firstName} {user?.lastName}</span>
            <span className="text-amber-400 font-mono text-[11px]">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Global System KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Teachers</span>
          <span className="text-xl font-bold text-white font-mono mt-1 block">{overview.totalTeachers}</span>
          <span className="text-[10px] text-indigo-400 mt-0.5 block">Staff Members</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Students</span>
          <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">{overview.totalStudents}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Unique Admission IDs</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Quizzes</span>
          <span className="text-xl font-bold text-purple-400 font-mono mt-1 block">{overview.totalQuizzes}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Online Tests</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Assessments</span>
          <span className="text-xl font-bold text-amber-400 font-mono mt-1 block">{overview.totalAssessments}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Recorded Scores</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Subjects</span>
          <span className="text-xl font-bold text-cyan-400 font-mono mt-1 block">{overview.totalSubjects}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Curriculum Courses</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">All System Users</span>
          <span className="text-xl font-bold text-white font-mono mt-1 block">{overview.totalUsers}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Accounts in DB</span>
        </div>
      </div>

      {/* Main Admin Section: Add Teacher + Management Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ADD TEACHER FORM (Super Admin Privilege) */}
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
          <div className="pb-3 border-b border-slate-700">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              Add & Provision New Teacher
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Super Admin creates authorized faculty accounts with automated Teacher IDs.
            </p>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateTeacher} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. David"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Adeleke"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="david.adeleke@school.edu"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">School / Branch</label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 mt-2"
            >
              <UserPlus className="w-4 h-4" />
              {submitting ? 'Creating Teacher Account...' : 'Provision Teacher Account'}
            </button>
          </form>
        </div>

        {/* MANAGEMENT VIEWS */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-6 flex flex-col">
          {/* Sub Navigation */}
          <div className="flex items-center gap-2 pb-3 border-b border-slate-700 mb-4">
            <button
              onClick={() => setActiveAdminTab('teachers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'teachers'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Faculty Members ({teachersList.length})
            </button>
            <button
              onClick={() => setActiveAdminTab('users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'users'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              All Users ({usersList.length})
            </button>
            <button
              onClick={() => setActiveAdminTab('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'audit'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Audit Logs
            </button>
            <button
              onClick={() => setActiveAdminTab('database')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'database'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              Database Explorer
            </button>
          </div>

          {/* TEACHERS LIST */}
          {activeAdminTab === 'teachers' && (
            <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
              {teachersList.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 bg-slate-900/80 border border-slate-700/80 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/30">
                      {t.firstName[0]}{t.lastName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {t.firstName} {t.lastName}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {t.teacherId}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{t.email}</span>
                        {t.phone && <span>• {t.phone}</span>}
                        <span>• {t.schoolName}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    Active Faculty
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ALL USERS LIST */}
          {activeAdminTab === 'users' && (
            <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-slate-400 text-[11px]">{u.email}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                      u.role === 'super_admin'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : u.role === 'teacher'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* AUDIT LOGS */}
          {activeAdminTab === 'audit' && (
            <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No system logs recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-400 font-mono text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs">{log.details}</p>
                    <span className="text-[10px] text-slate-500 block">
                      Actor: {log.actorName} ({log.actorRole})
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DATABASE EXPLORER (Direct Cloud SQL inspection) */}
          {activeAdminTab === 'database' && (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-700/80">
                {dbTables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setSelectedDbTable(t.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      selectedDbTable === t.name
                        ? 'bg-cyan-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                    }`}
                  >
                    <Table className="w-3 h-3" />
                    {t.name}
                    <span className="px-1 py-0.2 text-[9px] rounded bg-slate-800 text-cyan-300">
                      {t.rowCount}
                    </span>
                  </button>
                ))}
              </div>

              {(() => {
                const currentTableObj = dbTables.find((t) => t.name === selectedDbTable) || dbTables[0];
                if (!currentTableObj) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Connecting to Cloud SQL instance...
                    </div>
                  );
                }

                const rows = currentTableObj.sampleRows || [];
                const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

                return (
                  <div className="flex-1 overflow-auto max-h-[380px] bg-slate-900/90 rounded-xl border border-slate-700/80 p-3">
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <span className="text-slate-300 font-mono font-bold flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-cyan-400" />
                        Table: <span className="text-cyan-400">{currentTableObj.name}</span>
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Total Rows: <strong className="text-white">{currentTableObj.rowCount}</strong> (Showing preview)
                      </span>
                    </div>

                    {rows.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        This table currently has 0 rows.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono">
                          <thead className="bg-slate-800 text-slate-400 uppercase tracking-wider border-b border-slate-700">
                            <tr>
                              {columns.map((c) => (
                                <th key={c} className="py-2 px-2.5 whitespace-nowrap">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-slate-300">
                            {rows.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-slate-800/40">
                                {columns.map((c) => (
                                  <td key={c} className="py-2 px-2.5 whitespace-nowrap max-w-xs truncate text-slate-200">
                                    {row[c] === null ? (
                                      <span className="text-slate-600 italic">null</span>
                                    ) : typeof row[c] === 'object' ? (
                                      JSON.stringify(row[c])
                                    ) : (
                                      String(row[c])
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

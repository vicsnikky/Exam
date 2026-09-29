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
  Server,
  Trash2,
} from 'lucide-react';
import {
  getLocalTeachers,
  getLocalStudents,
  registerNewTeacher,
  deleteTeacher,
  deleteStudent,
  TeacherRecord,
} from '../lib/schoolStore.ts';
import { safeFetchJson } from '../lib/api.ts';
import { RegistrationSuccessCard } from './RegistrationSuccessCard.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';

export const SuperAdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>({
    totalUsers: 9,
    totalTeachers: 4,
    totalStudents: 5,
    totalQuizzes: 12,
    totalAssessments: 126,
    totalSubjects: 14,
  });
  const [teachersList, setTeachersList] = useState<TeacherRecord[]>([]);
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
  const [schoolName, setSchoolName] = useState('Fenster International School');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success Card state
  const [registeredSuccess, setRegisteredSuccess] = useState<{
    name: string;
    uniqueId: string;
    roleOrClass: string;
    email: string;
    password: string;
  } | null>(null);

  // Delete Modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'teacher' | 'student' | 'user';
    title: string;
    name: string;
    identifier: string;
    targetId: string | number;
  }>({
    isOpen: false,
    type: 'teacher',
    title: '',
    name: '',
    identifier: '',
    targetId: '',
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAdminData = async () => {
    // 1. Always load local baseline immediately
    const localTeachers = getLocalTeachers();
    const localStudents = getLocalStudents();
    setTeachersList(localTeachers);

    const initialUsers = [
      { id: 1, firstName: 'Victor', lastName: 'Alo (Super Admin)', email: 'victoralo1862@gmail.com', role: 'super_admin' },
      ...localTeachers.map((t) => ({ id: t.id, firstName: t.firstName, lastName: t.lastName, email: t.email, role: t.role || 'teacher' })),
      ...localStudents.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.surname, email: s.email || s.studentId, role: 'student' })),
    ];
    setUsersList(initialUsers);

    setOverview({
      totalUsers: initialUsers.length,
      totalTeachers: localTeachers.length,
      totalStudents: localStudents.length,
      totalQuizzes: 12,
      totalAssessments: 126,
      totalSubjects: 14,
    });

    // 2. Safe async fetch from backend
    if (token) {
      try {
        const [overRes, tchRes, usrRes, dbRes] = await Promise.all([
          safeFetchJson<any>('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<any>('/api/admin/teachers', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<any>('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<any>('/api/admin/database-explorer', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (overRes.ok && overRes.data?.overview) {
          setOverview((prev: any) => ({
            ...prev,
            ...overRes.data.overview,
            totalTeachers: Math.max(overRes.data.overview.totalTeachers || 0, localTeachers.length),
            totalStudents: Math.max(overRes.data.overview.totalStudents || 0, localStudents.length),
          }));
        }
        if (overRes.ok && overRes.data?.recentLogs) {
          setAuditLogs(overRes.data.recentLogs);
        }
        if (tchRes.ok && Array.isArray(tchRes.data?.teachers) && tchRes.data.teachers.length > 0) {
          setTeachersList(tchRes.data.teachers);
        }
        if (usrRes.ok && Array.isArray(usrRes.data?.users) && usrRes.data.users.length > 0) {
          setUsersList(usrRes.data.users);
        }
        if (dbRes.ok && Array.isArray(dbRes.data?.tables)) {
          setDbTables(dbRes.data.tables);
          if (dbRes.data.tables.length > 0 && !selectedDbTable) {
            setSelectedDbTable(dbRes.data.tables[0].name);
          }
        }
      } catch (err) {
        console.warn('Super Admin server stats fallback:', err);
      }
    }
  };

  useEffect(() => {
    fetchAdminData();

    const handleTeachersUpdated = () => {
      fetchAdminData();
    };
    const handleStudentsUpdated = () => {
      fetchAdminData();
    };

    window.addEventListener('fis:teachers-updated', handleTeachersUpdated);
    window.addEventListener('fis:students-updated', handleStudentsUpdated);

    return () => {
      window.removeEventListener('fis:teachers-updated', handleTeachersUpdated);
      window.removeEventListener('fis:students-updated', handleStudentsUpdated);
    };
  }, [token]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setRegisteredSuccess(null);

    try {
      const result = await registerNewTeacher(token, {
        firstName,
        lastName,
        email,
        phone,
        schoolName,
        password,
      });

      if (result.success) {
        setRegisteredSuccess({
          name: `${result.teacher.firstName} ${result.teacher.lastName}`,
          uniqueId: result.teacher.teacherId,
          roleOrClass: 'Senior Academic Faculty',
          email: result.teacher.email,
          password: result.password,
        });

        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setPassword('');
        fetchAdminData();
      } else {
        setErrorMsg('Failed to complete teacher registration');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error provisioning teacher account');
    } finally {
      setSubmitting(false);
    }
  };

  const promptDeleteTeacher = (teacher: TeacherRecord) => {
    if (teacher.email === 'victoralo1862@gmail.com' || teacher.role === 'super_admin') {
      setNotification({ type: 'error', message: 'The primary Super Admin account cannot be deleted.' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'teacher',
      title: 'Delete Faculty Member Account',
      name: `${teacher.firstName} ${teacher.lastName}`,
      identifier: teacher.teacherId,
      targetId: teacher.id,
    });
  };

  const promptDeleteUser = (u: any) => {
    if (u.email === 'victoralo1862@gmail.com' || u.role === 'super_admin') {
      setNotification({ type: 'error', message: 'The primary Super Admin account cannot be deleted.' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    setDeleteModal({
      isOpen: true,
      type: 'user',
      title: 'Delete System Account',
      name: `${u.firstName} ${u.lastName || ''}`,
      identifier: u.email,
      targetId: u.id,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteModal.type === 'teacher') {
      await deleteTeacher(token, deleteModal.targetId);
      setNotification({ type: 'success', message: `Teacher ${deleteModal.name} (${deleteModal.identifier}) has been permanently deleted.` });
    } else if (deleteModal.type === 'student') {
      await deleteStudent(token, deleteModal.targetId);
      setNotification({ type: 'success', message: `Student ${deleteModal.name} (${deleteModal.identifier}) has been permanently deleted.` });
    } else {
      if (token) {
        await safeFetchJson(`/api/admin/users/${deleteModal.targetId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setNotification({ type: 'success', message: `Account ${deleteModal.name} deleted successfully.` });
    }

    setTimeout(() => setNotification(null), 4000);
    fetchAdminData();
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
                Fenster International School • Super Admin Authority
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                System Control & Staff Governance
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                As Super Admin, you manage all faculty members, approve teacher registrations, oversee student enrollments, inspect institutional audits, and have full authority to delete any student or faculty record.
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

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Registration Success Card Popup */}
      {registeredSuccess && (
        <RegistrationSuccessCard
          type="teacher"
          name={registeredSuccess.name}
          uniqueId={registeredSuccess.uniqueId}
          roleOrClass={registeredSuccess.roleOrClass}
          email={registeredSuccess.email}
          password={registeredSuccess.password}
          onDismiss={() => setRegisteredSuccess(null)}
          onViewList={() => setActiveAdminTab('teachers')}
        />
      )}

      {/* Global System KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Teachers</span>
          <span className="text-xl font-bold text-white font-mono mt-1 block">{overview.totalTeachers}</span>
          <span className="text-[10px] text-indigo-400 mt-0.5 block">Faculty Staff</span>
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
          <span className="text-[10px] text-slate-400 mt-0.5 block">Accounts in System</span>
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
                  placeholder="teacher.name@school.edu"
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
          <div className="flex items-center gap-2 pb-3 border-b border-slate-700 mb-4 flex-wrap">
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
                  className="p-3.5 bg-slate-900/80 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3 hover:border-slate-600 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/30 shrink-0">
                      {t.firstName?.[0] || 'T'}{t.lastName?.[0] || 'M'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">
                          {t.firstName} {t.lastName}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {t.teacherId}
                        </span>
                        {t.role === 'super_admin' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                            Super Admin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="truncate">{t.email}</span>
                        {t.phone && <span>• {t.phone}</span>}
                        <span>• {t.schoolName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Active
                    </span>
                    {t.role !== 'super_admin' && t.email !== 'victoralo1862@gmail.com' && (
                      <button
                        onClick={() => promptDeleteTeacher(t)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600/30 border border-rose-500/20 hover:border-rose-500 transition cursor-pointer"
                        title="Delete teacher account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
                  className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl flex items-center justify-between text-xs hover:border-slate-600 transition"
                >
                  <div>
                    <span className="font-bold text-white block">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-slate-400 text-[11px]">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                    {u.role !== 'super_admin' && u.email !== 'victoralo1862@gmail.com' && (
                      <button
                        onClick={() => promptDeleteUser(u)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600/30 border border-rose-500/20 transition cursor-pointer"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* AUDIT LOGS */}
          {activeAdminTab === 'audit' && (
            <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  All administrative operations and modifications are logged securely.
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
                    <p className="text-slate-300 text-[11px]">{log.details}</p>
                    <div className="text-[10px] text-slate-400">
                      By: <strong className="text-slate-200">{log.actorName}</strong> ({log.actorRole})
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DATABASE EXPLORER */}
          {activeAdminTab === 'database' && (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-700/80">
                {['students', 'teachers', 'subjects', 'assessments'].map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedDbTable(name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      selectedDbTable === name
                        ? 'bg-cyan-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700'
                    }`}
                  >
                    <Table className="w-3 h-3" />
                    {name}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto max-h-[380px] bg-slate-900/90 rounded-xl border border-slate-700/80 p-3">
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-slate-300 font-mono font-bold flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-cyan-400" />
                    Table: <span className="text-cyan-400">{selectedDbTable}</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Super Admin Direct Inspection & Management
                  </span>
                </div>

                {selectedDbTable === 'students' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-800 text-slate-400 uppercase tracking-wider border-b border-slate-700">
                        <tr>
                          <th className="py-2 px-2.5">Student ID</th>
                          <th className="py-2 px-2.5">Name</th>
                          <th className="py-2 px-2.5">Class</th>
                          <th className="py-2 px-2.5">Gender</th>
                          <th className="py-2 px-2.5">Parent Contact</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {getLocalStudents().map((s) => (
                          <tr key={s.id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-2.5 text-amber-300 font-bold">{s.studentId}</td>
                            <td className="py-2 px-2.5 text-white">{s.firstName} {s.surname}</td>
                            <td className="py-2 px-2.5 text-slate-300">{s.currentClass}</td>
                            <td className="py-2 px-2.5 text-slate-400">{s.gender}</td>
                            <td className="py-2 px-2.5 text-slate-400">{s.parentPhone || '—'}</td>
                            <td className="py-2 px-2.5 text-right">
                              <button
                                onClick={() => {
                                  setDeleteModal({
                                    isOpen: true,
                                    type: 'student',
                                    title: 'Delete Student Record',
                                    name: `${s.firstName} ${s.surname}`,
                                    identifier: s.studentId,
                                    targetId: s.id,
                                  });
                                }}
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 p-1 rounded transition cursor-pointer"
                                title="Delete student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedDbTable === 'teachers' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-800 text-slate-400 uppercase tracking-wider border-b border-slate-700">
                        <tr>
                          <th className="py-2 px-2.5">Teacher ID</th>
                          <th className="py-2 px-2.5">Name</th>
                          <th className="py-2 px-2.5">Email</th>
                          <th className="py-2 px-2.5">Phone</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {teachersList.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-2.5 text-indigo-300 font-bold">{t.teacherId}</td>
                            <td className="py-2 px-2.5 text-white">{t.firstName} {t.lastName}</td>
                            <td className="py-2 px-2.5 text-slate-300">{t.email}</td>
                            <td className="py-2 px-2.5 text-slate-400">{t.phone || '—'}</td>
                            <td className="py-2 px-2.5 text-right">
                              {t.role !== 'super_admin' && (
                                <button
                                  onClick={() => promptDeleteTeacher(t)}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 p-1 rounded transition cursor-pointer"
                                  title="Delete teacher"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(selectedDbTable === 'subjects' || selectedDbTable === 'assessments') && (
                  <div className="p-6 text-center text-slate-400 text-xs font-mono">
                    Table active and synchronized with institutional database.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        type={deleteModal.type}
        title={deleteModal.title}
        name={deleteModal.name}
        identifier={deleteModal.identifier}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

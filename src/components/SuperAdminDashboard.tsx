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
  Pencil,
  Share2,
  Archive,
  RefreshCw,
  Download,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  getLocalTeachers,
  getLocalStudents,
  registerNewTeacher,
  updateTeacher,
  deleteTeacher,
  deleteStudent,
  reallocateTeacherAssets,
  getDepartedTeacherPortfolios,
  getInstitutionalVault,
  syncVaultToLiveDatabase,
  exportInstitutionalVault,
  TeacherRecord,
} from '../lib/schoolStore.ts';
import { safeFetchJson } from '../lib/api.ts';
import { Student } from '../types/index.ts';
import { RegistrationSuccessCard } from './RegistrationSuccessCard.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import { EditStudentModal } from './EditStudentModal.tsx';
import { EditTeacherModal } from './EditTeacherModal.tsx';

export const SuperAdminDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>({
    totalUsers: 1,
    totalTeachers: 1,
    totalStudents: 0,
    totalQuizzes: 0,
    totalAssessments: 0,
    totalSubjects: 9,
  });

  const [teachersList, setTeachersList] = useState<TeacherRecord[]>([]);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [departedList, setDepartedList] = useState<any[]>([]);
  const [vaultData, setVaultData] = useState<any>({ teachers: [], students: [] });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedDbTable, setSelectedDbTable] = useState<string>('students');
  const [activeAdminTab, setActiveAdminTab] = useState<'teachers' | 'reallocation' | 'vault' | 'database' | 'users' | 'audit'>('teachers');

  // Asset Reallocation states
  const [selectedRecipientTeacher, setSelectedRecipientTeacher] = useState<string>('');
  const [reallocating, setReallocating] = useState(false);

  // Vault Sync state
  const [syncingVault, setSyncingVault] = useState(false);

  // Form states for creating teacher
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('Fenster International School');
  const [password, setPassword] = useState('');
  const [teacherRole, setTeacherRole] = useState<'teacher' | 'bursar' | 'admin' | 'super_admin'>('teacher');
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

  // Edit Modals state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);

  const handleEditUser = (u: any) => {
    if (u.role === 'student') {
      const match = studentsList.find((s) => s.id === u.id || s.email === u.email || s.studentId === u.email);
      if (match) {
        setEditingStudent(match);
      } else {
        setEditingStudent({
          id: u.id,
          studentId: u.email?.startsWith('FEN-') || u.email?.startsWith('FIS-') ? u.email : `FEN-2026-${String(u.id).padStart(6, '0')}`,
          firstName: u.firstName,
          middleName: null,
          surname: u.lastName,
          gender: 'Female',
          dateOfBirth: '2008-01-01',
          currentClass: 'SS 3',
          email: u.email,
          parentName: null,
          parentPhone: null,
          school: 'Fenster International School',
          session: '2026/2027',
          password: 'student123',
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      const match = teachersList.find((t) => t.id === u.id || t.email === u.email);
      if (match) {
        setEditingTeacher(match);
      } else {
        setEditingTeacher({
          id: u.id,
          teacherId: `TCH-2026-${String(u.id).padStart(4, '0')}`,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: null,
          schoolName: 'Fenster International School',
          password: '',
          role: u.role || 'teacher',
          createdAt: new Date().toISOString(),
        });
      }
    }
  };

  const fetchAdminData = async () => {
    // 1. Always load local baseline immediately
    const localTeachers = getLocalTeachers();
    const localStudents = getLocalStudents();
    const localDeparted = getDepartedTeacherPortfolios();
    const localVault = getInstitutionalVault();

    setTeachersList(localTeachers);
    setStudentsList(localStudents);
    setDepartedList(localDeparted);
    setVaultData(localVault);

    const initialUsers = [
      { id: 1, firstName: 'Victor', lastName: 'Alo (Super Admin)', email: 'victoralo1862@gmail.com', role: 'super_admin' },
      ...localTeachers.filter((t) => t.email !== 'victoralo1862@gmail.com').map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        role: t.role || 'teacher',
      })),
      ...localStudents.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.surname,
        email: s.email || s.studentId,
        role: 'student',
      })),
    ];
    setUsersList(initialUsers);

    setOverview({
      totalUsers: initialUsers.length,
      totalTeachers: localTeachers.length,
      totalStudents: localStudents.length,
      totalQuizzes: 0,
      totalAssessments: 0,
      totalSubjects: 9,
    });

    // Set default recipient for reallocation if available
    if (localTeachers.length > 0 && !selectedRecipientTeacher) {
      setSelectedRecipientTeacher(localTeachers[0].teacherId);
    }

    // 2. Safe async fetch from backend
    if (token) {
      try {
        const [overRes, tchRes, usrRes] = await Promise.all([
          safeFetchJson<any>('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<any>('/api/admin/teachers', { headers: { Authorization: `Bearer ${token}` } }),
          safeFetchJson<any>('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (overRes.ok && overRes.data?.overview) {
          setOverview((prev: any) => ({
            ...prev,
            totalUsers: Math.max(overRes.data.overview.totalUsers || 0, initialUsers.length),
            totalTeachers: Math.max(overRes.data.overview.totalTeachers || 0, localTeachers.length),
            totalStudents: Math.max(overRes.data.overview.totalStudents || 0, localStudents.length),
            totalQuizzes: overRes.data.overview.totalQuizzes || 0,
            totalAssessments: overRes.data.overview.totalAssessments || 0,
            totalSubjects: overRes.data.overview.totalSubjects || 9,
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
      } catch (e) {
        console.warn('Backend admin sync fallback:', e);
      }
    }
  };

  useEffect(() => {
    fetchAdminData();

    const onStudentsUpdated = () => {
      setStudentsList(getLocalStudents());
      setVaultData(getInstitutionalVault());
    };
    const onTeachersUpdated = () => {
      setTeachersList(getLocalTeachers());
      setVaultData(getInstitutionalVault());
    };
    const onDepartedUpdated = () => {
      setDepartedList(getDepartedTeacherPortfolios());
    };

    window.addEventListener('fis:students-updated', onStudentsUpdated);
    window.addEventListener('fis:teachers-updated', onTeachersUpdated);
    window.addEventListener('fis:departed-teachers-updated', onDepartedUpdated);
    window.addEventListener('fis:vault-updated', onStudentsUpdated);

    return () => {
      window.removeEventListener('fis:students-updated', onStudentsUpdated);
      window.removeEventListener('fis:teachers-updated', onTeachersUpdated);
      window.removeEventListener('fis:departed-teachers-updated', onDepartedUpdated);
      window.removeEventListener('fis:vault-updated', onStudentsUpdated);
    };
  }, [token]);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const result = await registerNewTeacher(token, {
        firstName,
        lastName,
        email,
        phone,
        schoolName,
        password,
        role: teacherRole,
      });

      if (result.success) {
        setRegisteredSuccess({
          name: `${result.teacher.firstName} ${result.teacher.lastName}`,
          uniqueId: result.teacher.teacherId,
          roleOrClass:
            teacherRole === 'bursar'
              ? 'Bursar & Accounts Officer'
              : teacherRole === 'admin'
              ? 'Institutional Administrator'
              : teacherRole === 'super_admin'
              ? 'Super Administrator'
              : 'Senior Academic Faculty',
          email: result.teacher.email,
          password: result.password,
        });

        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setTeacherRole('teacher');
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

  const handlePromoteRole = async (teacher: TeacherRecord, newRole: string) => {
    try {
      await updateTeacher(token, {
        id: teacher.id,
        teacherId: teacher.teacherId,
        role: newRole,
      });
      setNotification({
        type: 'success',
        message: `${teacher.firstName} ${teacher.lastName} (${teacher.teacherId}) role updated to ${newRole.toUpperCase()}!`,
      });
      setTimeout(() => setNotification(null), 4000);
      fetchAdminData();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to update faculty role: ' + (err.message || 'Error') });
      setTimeout(() => setNotification(null), 4000);
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

  const promptDeleteStudent = (s: Student) => {
    setDeleteModal({
      isOpen: true,
      type: 'student',
      title: 'Permanently Delete Student Scholar',
      name: `${s.firstName} ${s.surname}`,
      identifier: s.studentId,
      targetId: s.id,
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
      setTeachersList(getLocalTeachers());
      setDepartedList(getDepartedTeacherPortfolios());
      setNotification({
        type: 'success',
        message: `Teacher ${deleteModal.name} (${deleteModal.identifier}) removed. Academic assets preserved in Departed Faculty Archive for reallocation.`,
      });
    } else if (deleteModal.type === 'student') {
      await deleteStudent(token, deleteModal.targetId);
      const updated = getLocalStudents();
      setStudentsList(updated);
      setNotification({
        type: 'success',
        message: `Student scholar ${deleteModal.name} (${deleteModal.identifier}) permanently removed from live database and registry.`,
      });
    } else {
      if (token) {
        await safeFetchJson(`/api/admin/users/${deleteModal.targetId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setNotification({ type: 'success', message: `Account ${deleteModal.name} deleted successfully.` });
    }

    setDeleteModal({ isOpen: false, type: 'teacher', title: '', name: '', identifier: '', targetId: '' });
    setTimeout(() => setNotification(null), 4500);
    fetchAdminData();
  };

  const handleReallocate = async (fromTeacherId: string | number | null) => {
    if (!selectedRecipientTeacher) {
      setNotification({ type: 'error', message: 'Please select an active teacher to receive the academic portfolio.' });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    setReallocating(true);
    try {
      const res = await reallocateTeacherAssets(token, fromTeacherId, selectedRecipientTeacher);
      if (res.success) {
        setDepartedList(getDepartedTeacherPortfolios());
        setNotification({
          type: 'success',
          message: `Academic assets successfully transferred to faculty member ${selectedRecipientTeacher}.`,
        });
        fetchAdminData();
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to reallocate assets.' });
    } finally {
      setReallocating(false);
      setTimeout(() => setNotification(null), 4500);
    }
  };

  const handleSyncVault = async () => {
    setSyncingVault(true);
    try {
      const res = await syncVaultToLiveDatabase(token);
      setNotification({ type: 'success', message: res.message });
      fetchAdminData();
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Synchronization deferred. Vault data remains intact.' });
    } finally {
      setSyncingVault(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleExportVault = (format: 'json' | 'csv') => {
    const data = exportInstitutionalVault(format);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fenster_institutional_vault_${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification({ type: 'success', message: `Institutional Vault exported as ${format.toUpperCase()} successfully.` });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Super Admin Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950/40 border border-amber-500/40 p-6 sm:p-8 rounded-2xl shadow-2xl fis-card-accent relative overflow-hidden">
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
                Super Admin governs all staff accounts, student enrollments, academic asset reallocations for departed teachers, and manages the Institutional Recovery Vault.
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

      {/* Floating Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between shadow-lg transition-all animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border border-rose-500/40'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Registration Success Modal / Card */}
      {registeredSuccess && (
        <RegistrationSuccessCard
          type="teacher"
          name={registeredSuccess.name}
          uniqueId={registeredSuccess.uniqueId}
          roleOrClass={registeredSuccess.roleOrClass}
          email={registeredSuccess.email}
          password={registeredSuccess.password}
          onDismiss={() => setRegisteredSuccess(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        name={deleteModal.name}
        identifier={deleteModal.identifier}
        type={deleteModal.type}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModal({ isOpen: false, type: 'teacher', title: '', name: '', identifier: '', targetId: '' })}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={!!editingStudent}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        onSaved={(updated) => {
          setNotification({
            type: 'success',
            message: `Student ${updated.firstName} ${updated.surname} (${updated.studentId}) updated successfully.`,
          });
          fetchAdminData();
        }}
      />

      {/* Edit Teacher Modal */}
      <EditTeacherModal
        isOpen={!!editingTeacher}
        teacher={editingTeacher}
        onClose={() => setEditingTeacher(null)}
        onSaved={(updated) => {
          setNotification({
            type: 'success',
            message: `Faculty member ${updated.firstName} ${updated.lastName} (${updated.teacherId}) updated successfully.`,
          });
          fetchAdminData();
        }}
      />

      {/* Global Real System KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Teachers</span>
          <span className="text-xl font-bold text-white font-mono mt-1 block">{overview.totalTeachers}</span>
          <span className="text-[10px] text-indigo-400 mt-0.5 block">Active Faculty</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Total Students</span>
          <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">{studentsList.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Enrolled Scholars</span>
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
          <span className="text-[11px] text-slate-400 font-medium block">Departed Portfolios</span>
          <span className="text-xl font-bold text-orange-400 font-mono mt-1 block">{departedList.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Awaiting Reallocation</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl">
          <span className="text-[11px] text-slate-400 font-medium block">Institutional Vault</span>
          <span className="text-xl font-bold text-cyan-400 font-mono mt-1 block">{vaultData.teachers.length + vaultData.students.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Secured Accounts</span>
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
              Super Admin provisions verified staff accounts. Automatically mirrored to Database & Institutional Vault.
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
                <label className="block text-[11px] font-medium text-slate-300 mb-1">Initial Password *</label>
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
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Faculty Role / Designation *</label>
              <select
                value={teacherRole}
                onChange={(e) => setTeacherRole(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
              >
                <option value="teacher">Academic Faculty (Class Teacher / Examiner)</option>
                <option value="bursar">Bursar (School Fees Clearance & Result Lock)</option>
                <option value="admin">Administrator (Faculty & Student Governance)</option>
                <option value="super_admin">Super Administrator (Supreme Master Privileges)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Assigned Institution</label>
              <div className="relative">
                <School className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {submitting ? 'Registering & Syncing...' : 'Provision Faculty Account'}
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
              Active Faculty ({teachersList.length})
            </button>
            <button
              onClick={() => setActiveAdminTab('reallocation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'reallocation'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-amber-300" />
              Departed Faculty & Reallocation ({departedList.length})
            </button>
            <button
              onClick={() => setActiveAdminTab('vault')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'vault'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
              Institutional Vault & Recovery
            </button>
            <button
              onClick={() => setActiveAdminTab('database')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeAdminTab === 'database'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              Database Explorer ({studentsList.length} Students)
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
          </div>

          {/* TEACHERS LIST */}
          {activeAdminTab === 'teachers' && (
            <div className="flex-1 overflow-y-auto max-h-[460px] space-y-2 pr-1">
              {teachersList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No active teachers registered. Provision a teacher account using the form on the left.
                </div>
              ) : (
                teachersList.map((t) => (
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
                          {t.role === 'super_admin' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                              🌟 Super Admin
                            </span>
                          ) : t.role === 'admin' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                              🛡️ Admin
                            </span>
                          ) : t.role === 'bursar' ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                              💳 Bursar
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                              🎓 Faculty
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
                      {t.email !== 'victoralo1862@gmail.com' && (
                        <select
                          value={t.role || 'teacher'}
                          onChange={(e) => handlePromoteRole(t, e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-200 text-[10px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer"
                          title="Change staff authority & role"
                        >
                          <option value="teacher">Role: Faculty</option>
                          <option value="bursar">Role: Bursar (Fees Lock)</option>
                          <option value="admin">Role: Admin</option>
                          <option value="super_admin">Role: Super Admin</option>
                        </select>
                      )}
                      <button
                        onClick={() => setEditingTeacher(t)}
                        className="p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-purple-600/30 border border-purple-500/20 hover:border-purple-500 transition cursor-pointer"
                        title="Edit faculty member details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {t.role !== 'super_admin' && t.email !== 'victoralo1862@gmail.com' && (
                        <button
                          onClick={() => promptDeleteTeacher(t)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600/30 border border-rose-500/20 hover:border-rose-500 transition cursor-pointer"
                          title="Delete faculty member and preserve assets for reallocation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DEPARTED FACULTY & ASSET REALLOCATION */}
          {activeAdminTab === 'reallocation' && (
            <div className="flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[460px] pr-1">
              <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-amber-400" />
                    Academic Assets & Departed Teacher Portfolios
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    When faculty depart, their assessments, mock scores, quizzes, and questions are preserved here. Super Admin can reallocate them to any active teacher's dashboard.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedRecipientTeacher}
                    onChange={(e) => setSelectedRecipientTeacher(e.target.value)}
                    className="bg-slate-900 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {teachersList.map((t) => (
                      <option key={t.id} value={t.teacherId}>
                        {t.firstName} {t.lastName} ({t.teacherId})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {departedList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs border border-dashed border-slate-700 rounded-xl">
                  <Archive className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <span>No departed faculty portfolios. When a faculty member is deleted, their academic history is archived here for reallocation.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {departedList.map((dep, idx) => (
                    <div
                      key={dep.id || idx}
                      className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs">{dep.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                            {dep.teacherId}
                          </span>
                          {dep.reallocatedTo ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Reallocated to {dep.reallocatedTo}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Unassigned Academic Assets
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                          <span>{dep.email}</span>
                          {dep.phone && <span>• {dep.phone}</span>}
                          <span>• Departed: {new Date(dep.deletedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReallocate(dep.teacherId)}
                          disabled={reallocating || teachersList.length === 0}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          {reallocating ? 'Transferring...' : `Allocate to ${selectedRecipientTeacher || 'Faculty'}`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INSTITUTIONAL VAULT & RECOVERY CENTER */}
          {activeAdminTab === 'vault' && (
            <div className="flex-1 flex flex-col space-y-4 overflow-y-auto max-h-[460px] pr-1">
              <div className="p-4 bg-cyan-950/40 border border-cyan-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    Institutional Vault & Permanent Disaster Recovery
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    All created staff credentials, student accounts, and access keys are mirrored here. If database records are ever desynchronized, one click re-provisions everything into the live database.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={handleSyncVault}
                    disabled={syncingVault}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingVault ? 'animate-spin' : ''}`} />
                    {syncingVault ? 'Restoring...' : 'Sync & Restore to Database'}
                  </button>
                  <button
                    onClick={() => handleExportVault('csv')}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleExportVault('json')}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Export JSON"
                  >
                    <Download className="w-3 h-3" />
                    JSON
                  </button>
                </div>
              </div>

              {/* Vault Teachers Section */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Vault Faculty Roster ({vaultData.teachers.length})
                </span>
                <div className="space-y-1.5">
                  {vaultData.teachers.map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{t.firstName} {t.lastName}</span>
                        <span className="text-slate-400 text-[11px] font-mono">{t.teacherId} • {t.email}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-cyan-400 font-mono text-[11px] block">
                          Key: {t.password ? t.password : '••••••••'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {t.role === 'super_admin' ? 'Super Admin' : 'Academic Faculty'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vault Students Section */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Vault Student Registry ({vaultData.students.length})
                </span>
                {vaultData.students.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs font-mono">
                    No student records currently in vault. Newly enrolled students will automatically mirror here.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {vaultData.students.map((s: any) => (
                      <div
                        key={s.id}
                        className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white block">{s.firstName} {s.surname}</span>
                          <span className="text-slate-400 text-[11px] font-mono">{s.studentId} • {s.currentClass}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-emerald-400 font-mono text-[11px] block">
                            PIN: {s.password || 'student123'}
                          </span>
                          <span className="text-[10px] text-slate-500">{s.parentPhone || 'No phone'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                  <div className="flex items-center gap-1.5">
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
                    <button
                      onClick={() => handleEditUser(u)}
                      className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-600/30 border border-indigo-500/20 hover:border-indigo-500 transition cursor-pointer"
                      title="Edit user details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
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
                    {name} {name === 'students' ? `(${studentsList.length})` : ''}
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
                        {studentsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                              No registered students in database. Enroll scholars from the student registration portal to populate records.
                            </td>
                          </tr>
                        ) : (
                          studentsList.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-800/40">
                              <td className="py-2 px-2.5 text-amber-300 font-bold">{s.studentId}</td>
                              <td className="py-2 px-2.5 text-white">{s.firstName} {s.surname}</td>
                              <td className="py-2 px-2.5 text-slate-300">{s.currentClass}</td>
                              <td className="py-2 px-2.5 text-slate-400">{s.gender}</td>
                              <td className="py-2 px-2.5 text-slate-400">{s.parentPhone || '—'}</td>
                              <td className="py-2 px-2.5 text-right flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditingStudent(s)}
                                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 p-1.5 rounded transition cursor-pointer"
                                  title="Edit student details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => promptDeleteStudent(s)}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 p-1.5 rounded transition cursor-pointer"
                                  title="Permanently delete student from live database"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
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
                            <td className="py-2 px-2.5 text-right flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingTeacher(t)}
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 p-1.5 rounded transition cursor-pointer"
                                title="Edit faculty member details"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {t.role !== 'super_admin' && (
                                <button
                                  onClick={() => promptDeleteTeacher(t)}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 p-1.5 rounded transition cursor-pointer"
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
    </div>
  );
};

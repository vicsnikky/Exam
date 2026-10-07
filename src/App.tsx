import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext.tsx';
import { FIS_LOGOS } from './constants/branding.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { DashboardHome } from './components/DashboardHome.tsx';
import { StudentRegistration } from './components/StudentRegistration.tsx';
import { StudentSearch } from './components/StudentSearch.tsx';
import { StudentProfile } from './components/StudentProfile.tsx';
import { SubjectManager } from './components/SubjectManager.tsx';
import { AiQuestionGenerator } from './components/AiQuestionGenerator.tsx';
import { QuizBuilder } from './components/QuizBuilder.tsx';
import { StudentQuizTaker } from './components/StudentQuizTaker.tsx';
import { AddScoreModal } from './components/AddScoreModal.tsx';
import { ResultsView } from './components/ResultsView.tsx';
import { SuperAdminDashboard } from './components/SuperAdminDashboard.tsx';
import { SS3MockStudentDashboard } from './components/SS3MockStudentDashboard.tsx';
import { SS3MockTeacherModule } from './components/SS3MockTeacherModule.tsx';
import { BursarDashboard } from './components/BursarDashboard.tsx';
import { AnonymousComplaintModal } from './components/AnonymousComplaintModal.tsx';
import { ChangePasswordModal } from './components/ChangePasswordModal.tsx';
import { ExecutiveComplaintsManager } from './components/ExecutiveComplaintsManager.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Sparkles,
  Layers,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  UserPlus,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  PlusCircle,
  HelpCircle,
  Award,
  ShieldAlert,
  PenTool,
  CreditCard,
  Lock,
  DollarSign,
  MessageSquareWarning,
  Key,
  KeyRound
} from 'lucide-react';
import { Student } from './types/index.ts';

export default function App() {
  const { user, token, logout, isLoading } = useAuth();

  const isStudent = user?.role === 'student';
  const isBursar = user?.role === 'bursar';
  const isVictorSuperAdmin = user?.role === 'super_admin';
  const isDirector = user?.role === 'director';
  const isPrincipal = user?.role === 'principal';
  const isAdminOnly = user?.role === 'admin';

  // Super Admin (Victor Alo), Director (School Owner), and Principal ALL have full access to everything!
  const isExecutive = isVictorSuperAdmin || isDirector || isPrincipal;
  const isSuperAdmin = isExecutive;
  const canAccessAdminConsole = isExecutive || isAdminOnly;
  const hasBursarAccess = isBursar || isExecutive;
  const canRegisterStudent = !isStudent && !isBursar; // Teachers, Admins, Principal, Director & Super Admin can register students on their dashboard
  const isTeacher = !isStudent && !isBursar;

  const adminConsoleTitle = isVictorSuperAdmin
    ? 'Super Admin Console'
    : isDirector
    ? 'Director Console'
    : isPrincipal
    ? 'Principal Console'
    : 'Admin Console';

  const rawClass = (
    user?.currentClass ||
    (user as any)?.studentProfile?.currentClass ||
    (user as any)?.class ||
    ''
  ).toUpperCase().replace(/\s+/g, '');
  const isSS3Student = isStudent && rawClass.includes('SS3');

  const getInitialTab = (): string => {
    if (user?.role === 'bursar') return 'bursar-console';
    if (user?.role === 'student') {
      return 'student-profile';
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAnonymousModal, setShowAnonymousModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    const handleOpenPwd = () => setShowPasswordModal(true);
    window.addEventListener('fis:open-change-password', handleOpenPwd);
    return () => window.removeEventListener('fis:open-change-password', handleOpenPwd);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        Initializing Fenster International School Portal...
      </div>
    );
  }

  // If not authenticated, render login/register modal
  if (!token || !user) {
    return <AuthModal onSuccess={() => setActiveTab(getInitialTab())} />;
  }

  const navigateToStudentProfile = (st: Student) => {
    setSelectedStudent(st);
    setActiveTab('student-profile');
  };

  const navigateToAddScoreForStudent = (st: Student) => {
    setSelectedStudent(st);
    setActiveTab('add-score');
  };

  const handleSearchStudents = (query: string) => {
    setSearchInitialQuery(query);
    setActiveTab('students');
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'super-admin':
        return canAccessAdminConsole ? <SuperAdminDashboard /> : null;
      case 'complaints':
        return isExecutive ? (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-amber-400" />
                Executive Confidential Complaints & Suggestion Box
              </h2>
              <p className="text-xs text-slate-400">
                Official grievance and suggestion channel delivered directly to the Super Administrator, School Director, and Principal portfolios.
              </p>
            </div>
            <ExecutiveComplaintsManager />
          </div>
        ) : null;
      case 'bursar-console':
        return hasBursarAccess ? <BursarDashboard /> : null;
      case 'dashboard':
        return !isStudent && !isBursar ? (
          <DashboardHome
            onNavigate={(tab) => setActiveTab(tab)}
            onSelectStudent={navigateToStudentProfile}
          />
        ) : null;
      case 'register-student':
        return canRegisterStudent ? (
          <StudentRegistration
            onStudentRegistered={navigateToStudentProfile}
            onNavigateSearch={handleSearchStudents}
          />
        ) : null;
      case 'students':
        return (
          <StudentSearch
            initialQuery={searchInitialQuery}
            onSelectStudent={navigateToStudentProfile}
          />
        );
      case 'student-profile':
        return (
          <StudentProfile
            studentIdOrId={selectedStudent?.id || selectedStudent?.studentId || user?.studentId || 'FIS-2026-000001'}
            initialStudent={selectedStudent || undefined}
            onBack={() => setActiveTab(isStudent ? (isSS3Student ? 'ss3-mock-student' : 'take-quiz') : (isBursar ? 'bursar-console' : 'students'))}
            onAddScoreForStudent={!isBursar ? navigateToAddScoreForStudent : undefined}
          />
        );
      case 'subjects':
        return isTeacher || isSuperAdmin ? <SubjectManager /> : null;
      case 'question-generator':
        return isTeacher || isSuperAdmin ? (
          <AiQuestionGenerator
            onQuestionsSaved={() => setActiveTab('quizzes')}
            onNavigateQuizBuilder={() => setActiveTab('quizzes')}
          />
        ) : null;
      case 'quizzes':
        return isTeacher || isSuperAdmin ? <QuizBuilder onQuizCreated={() => setActiveTab('results')} /> : null;
      case 'add-score':
        return !isStudent && !isBursar ? (
          <AddScoreModal
            preselectedStudent={selectedStudent}
            onScoreSaved={() => setActiveTab('results')}
          />
        ) : null;
      case 'results':
        return <ResultsView />;
      case 'ss3-mock-student':
        return canAccessAdminConsole ? (
          <SS3MockStudentDashboard />
        ) : (
          <StudentProfile studentIdOrId={user?.studentId || ''} />
        );
      case 'ss3-mock-teacher':
        return isTeacher || isSuperAdmin ? <SS3MockTeacherModule /> : null;
      case 'take-quiz':
        return <StudentQuizTaker onCompleted={() => setActiveTab('student-profile')} />;
      default:
        if (isBursar) return <BursarDashboard />;
        if (isStudent) {
          return (
            <StudentProfile
              studentIdOrId={user?.studentId || ''}
              onBack={() => setActiveTab('take-quiz')}
            />
          );
        }
        return (
          <DashboardHome
            onNavigate={(tab) => setActiveTab(tab)}
            onSelectStudent={navigateToStudentProfile}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-400 selection:text-emerald-950">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 fis-card-accent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div
              onClick={() => setActiveTab(getInitialTab())}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="h-11 w-11 rounded-xl bg-white p-1 shadow-md border border-amber-400/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                <img
                  src={FIS_LOGOS.crest}
                  alt="FIS Crest"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white tracking-tight text-sm sm:text-base group-hover:text-amber-300 transition">
                    Fenster International School
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    PORTAL
                  </span>
                </div>
                <span className="text-[11px] text-amber-300/90 font-medium block leading-tight">
                  Academic Assessment & Bursary Clearance System
                </span>
              </div>
            </div>
          </div>

          {/* User profile & actions in navbar */}
          <div className="flex items-center gap-3">
            {/* Quick Anonymous Complaint Button for all logged in users */}
            <button
              onClick={() => setShowAnonymousModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Submit Anonymous Suggestion or Complaint"
            >
              <MessageSquareWarning className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Suggestion Box</span>
            </button>

            {/* Staff Change Password Action */}
            {!isStudent && (
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Change Your Account Password"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Change Password</span>
              </button>
            )}

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-white flex items-center justify-end gap-1.5">
                {user.firstName} {user.lastName || user.surname}
                {isVictorSuperAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    SUPER ADMIN
                  </span>
                )}
                {isDirector && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    DIRECTOR (OWNER)
                  </span>
                )}
                {isPrincipal && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    PRINCIPAL
                  </span>
                )}
                {isAdminOnly && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    ADMIN
                  </span>
                )}
                {isBursar && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    BURSAR
                  </span>
                )}
                {isStudent && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    STUDENT ({user.currentClass || 'Scholar'})
                  </span>
                )}
                {user?.role === 'teacher' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                    FACULTY TEACHER
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isStudent ? `ID: ${user.studentId}` : isBursar ? 'Bursary Fee Clearance & Locks' : isExecutive ? 'Full System Authority' : `Faculty: ${user.teacherId || user.email}`}
              </span>
            </div>

            {!isStudent && (
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-semibold transition cursor-pointer shadow-sm"
                title="Change Staff Account Password"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Change Password</span>
              </button>
            )}

            <button
              onClick={logout}
              className="p-2.5 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer border border-transparent hover:border-amber-500/20"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <AnonymousComplaintModal
        isOpen={showAnonymousModal}
        onClose={() => setShowAnonymousModal(false)}
      />

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      {/* Main Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-6">
          <nav className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1 relative shadow-sm">
            
            {/* 1. BURSAR NAVIGATION (NO TEACHER PRIVILEGES) */}
            {isBursar && (
              <>
                <div className="px-3 py-1.5 mb-1 text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-700/60">
                  <CreditCard className="w-3.5 h-3.5" />
                  Bursary Governance
                </div>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('bursar-console')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'bursar-console' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'bursar-console' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-rose-700 rounded-xl shadow-md shadow-rose-950/40 border border-rose-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Lock className="w-4 h-4 shrink-0 text-amber-300" />
                    School Fees & Result Lock
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('students')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'students' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'students' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Users className="w-4 h-4 shrink-0" />
                    Students Directory
                  </span>
                </motion.button>
              </>
            )}

            {/* 2. SUPER ADMIN / DIRECTOR / PRINCIPAL / ADMIN / TEACHER NAVIGATION */}
            {!isStudent && !isBursar && (
              <>
                {canAccessAdminConsole && (
                  <>
                    <motion.button
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab('super-admin')}
                      className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer mb-2 ${
                        activeTab === 'super-admin'
                          ? 'text-slate-950 font-bold'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                      }`}
                    >
                      {activeTab === 'super-admin' && (
                        <motion.div
                          layoutId="activeSidebarIndicator"
                          className="absolute inset-0 bg-amber-500 rounded-xl shadow-md shadow-amber-500/20 z-0"
                          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-3">
                        <ShieldAlert className={`w-4 h-4 shrink-0 ${activeTab === 'super-admin' ? 'text-slate-950' : 'text-amber-400'}`} />
                        {adminConsoleTitle}
                      </span>
                    </motion.button>

                    {/* Super Admin, Director, Principal have full Bursary access to lock/unlock students & debtors */}
                    {hasBursarAccess && (
                      <motion.button
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('bursar-console')}
                        className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer mb-2 ${
                          activeTab === 'bursar-console'
                            ? 'text-white'
                            : 'bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:bg-rose-950/70'
                        }`}
                      >
                        {activeTab === 'bursar-console' && (
                          <motion.div
                            layoutId="activeSidebarIndicator"
                            className="absolute inset-0 bg-rose-700 rounded-xl shadow-md shadow-rose-950/40 border border-rose-600/40 z-0"
                            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-3">
                          <CreditCard className="w-4 h-4 shrink-0 text-rose-400" />
                          Bursary Fees & Lock
                        </span>
                      </motion.button>
                    )}

                    {/* Complaints Box (Victor Alo Super Admin, Director, Principal) */}
                    {isExecutive && (
                      <motion.button
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab('complaints')}
                        className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer mb-2 ${
                          activeTab === 'complaints'
                            ? 'text-slate-950 font-bold'
                            : 'bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:bg-amber-950/70'
                        }`}
                      >
                        {activeTab === 'complaints' && (
                          <motion.div
                            layoutId="activeSidebarIndicator"
                            className="absolute inset-0 bg-amber-500 rounded-xl shadow-md shadow-amber-500/20 z-0"
                            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-3">
                          <MessageSquareWarning className={`w-4 h-4 shrink-0 ${activeTab === 'complaints' ? 'text-slate-950' : 'text-amber-400'}`} />
                          Complaints Box
                        </span>
                      </motion.button>
                    )}
                  </>
                )}

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'dashboard' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'dashboard' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    Dashboard
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('students')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'students' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'students' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Users className="w-4 h-4 shrink-0" />
                    Students Directory
                  </span>
                </motion.button>

                {canRegisterStudent && (
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab('register-student')}
                    className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === 'register-student' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                    }`}
                  >
                    {activeTab === 'register-student' && (
                      <motion.div
                        layoutId="activeSidebarIndicator"
                        className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-3">
                      <UserPlus className="w-4 h-4 shrink-0 text-amber-400" />
                      Register Student
                    </span>
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('subjects')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'subjects' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'subjects' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    Subjects Management
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('question-generator')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'question-generator' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'question-generator' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <PenTool className="w-4 h-4 shrink-0 text-amber-400" />
                    Create Questions & Bank
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('quizzes')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'quizzes' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'quizzes' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Layers className="w-4 h-4 shrink-0" />
                    Quiz / Test Builder
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('add-score')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'add-score' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'add-score' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    Add Student Score
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('results')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'results' ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'results' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <FileText className="w-4 h-4 shrink-0" />
                    Class Broadsheet & Results
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('ss3-mock-teacher')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'ss3-mock-teacher' ? 'text-white' : 'text-amber-300/90 hover:text-white hover:bg-slate-700/40'
                  }`}
                >
                  {activeTab === 'ss3-mock-teacher' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Award className="w-4 h-4 shrink-0 text-amber-400" />
                    SS3 Weekly Mock Module
                  </span>
                </motion.button>

                <div className="pt-2 border-t border-slate-700/60 my-1" />

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('take-quiz')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'take-quiz'
                      ? 'text-slate-950 font-bold'
                      : 'text-amber-300/80 hover:bg-amber-500/10 hover:text-amber-300'
                  }`}
                >
                  {activeTab === 'take-quiz' && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-amber-500 rounded-xl shadow-md shadow-amber-500/20 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <FileCheck2 className={`w-4 h-4 shrink-0 ${activeTab === 'take-quiz' ? 'text-slate-950' : 'text-amber-400'}`} />
                    Student Exam Simulator
                  </span>
                </motion.button>
              </>
            )}

            {/* 3. STUDENT NAVIGATION (MOCK MODULE RESTRICTED TO ADMINS) */}
            {isStudent && (
              <>
                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('take-quiz')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'take-quiz'
                      ? 'text-white'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  {activeTab === 'take-quiz' && (
                    <motion.div
                      layoutId="activeSidebarIndicatorStudent"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <FileCheck2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    Take Assigned Quizzes
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedStudent((user as any).studentProfile || null);
                    setActiveTab('student-profile');
                  }}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'student-profile'
                      ? 'text-white'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  {activeTab === 'student-profile' && (
                    <motion.div
                      layoutId="activeSidebarIndicatorStudent"
                      className="absolute inset-0 bg-emerald-700 rounded-xl shadow-md shadow-emerald-900/40 border border-emerald-600/40 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Award className="w-4 h-4 shrink-0 text-emerald-400" />
                    My Academic Record & Transcript
                  </span>
                </motion.button>
              </>
            )}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur lg:hidden p-4 flex items-start justify-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -16 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2 w-full max-w-sm mt-12 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                  <span className="font-bold text-white text-sm">Navigation Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isBursar && (
                  <>
                    <button
                      onClick={() => { setActiveTab('bursar-console'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold border transition ${
                        activeTab === 'bursar-console' ? 'bg-rose-700 text-white border-rose-500' : 'bg-slate-900 text-rose-300 border-slate-700'
                      }`}
                    >
                      Bursary Fees & Result Lock
                    </button>
                    <button
                      onClick={() => { setActiveTab('students'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'students' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Students Directory
                    </button>
                  </>
                )}

                {!isStudent && !isBursar && (
                  <>
                    {canAccessAdminConsole && (
                      <button
                        onClick={() => { setActiveTab('super-admin'); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold border transition ${
                          activeTab === 'super-admin'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-purple-950/60 text-purple-300 border-purple-800'
                        }`}
                      >
                        {adminConsoleTitle}
                      </button>
                    )}
                    {hasBursarAccess && (
                      <button
                        onClick={() => { setActiveTab('bursar-console'); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold border transition ${
                          activeTab === 'bursar-console'
                            ? 'bg-rose-700 text-white border-rose-500'
                            : 'bg-rose-950/60 text-rose-300 border-rose-800'
                        }`}
                      >
                        Bursary Fees & Lock
                      </button>
                    )}
                    {isExecutive && (
                      <button
                        onClick={() => { setActiveTab('complaints'); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold border transition ${
                          activeTab === 'complaints'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800'
                        }`}
                      >
                        Complaints Box
                      </button>
                    )}
                    <button
                      onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'dashboard' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => { setActiveTab('students'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'students' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Students Directory
                    </button>
                    {canRegisterStudent && (
                      <button
                        onClick={() => { setActiveTab('register-student'); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                          activeTab === 'register-student' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Register Student
                      </button>
                    )}
                    <button
                      onClick={() => { setActiveTab('subjects'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'subjects' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Subjects Management
                    </button>
                    <button
                      onClick={() => { setActiveTab('question-generator'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'question-generator' ? 'bg-emerald-700 text-white font-semibold' : 'text-amber-300 hover:bg-slate-700 font-semibold'
                      }`}
                    >
                      Create Questions & Bank
                    </button>
                    <button
                      onClick={() => { setActiveTab('quizzes'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'quizzes' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Quiz / Test Builder
                    </button>
                    <button
                      onClick={() => { setActiveTab('add-score'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'add-score' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Add Student Score
                    </button>
                    <button
                      onClick={() => { setActiveTab('results'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'results' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Results & Ledgers
                    </button>
                    <button
                      onClick={() => { setActiveTab('ss3-mock-teacher'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'ss3-mock-teacher' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-amber-300 hover:bg-slate-700 font-semibold'
                      }`}
                    >
                      SS3 Weekly Mock Module
                    </button>
                    <button
                      onClick={() => { setActiveTab('take-quiz'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'take-quiz' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-emerald-400 hover:bg-slate-700 font-semibold'
                      }`}
                    >
                      Student Exam Simulator
                    </button>
                  </>
                )}

                {isStudent && (
                  <>
                    <button
                      onClick={() => { setActiveTab('take-quiz'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'take-quiz' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Take Assigned Quizzes
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStudent((user as any).studentProfile || null);
                        setActiveTab('student-profile');
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'student-profile' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      My Academic Record & Transcript
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Main Workspace Area with Error Boundary and Tab Transitions */}
        <main className="flex-1 min-w-0">
          <ErrorBoundary fallbackTitle="Portal Workspace Area">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + (activeTab === 'student-profile' ? `-${selectedStudent?.id || ''}` : '')}
                initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full min-w-0"
              >
                {renderActiveTabContent()}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

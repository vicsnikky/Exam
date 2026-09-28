import React, { useState } from 'react';
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
  PenTool
} from 'lucide-react';
import { Student } from './types/index.ts';

export default function App() {
  const { user, token, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(() => (user?.role === 'student' ? 'ss3-mock-student' : 'dashboard'));
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm">
        Initializing School Assessment System...
      </div>
    );
  }

  // If not authenticated, render login/register modal
  if (!token || !user) {
    return <AuthModal onSuccess={() => setActiveTab(user?.role === 'student' ? 'ss3-mock-student' : 'dashboard')} />;
  }

  const isStudent = user.role === 'student';
  const isSuperAdmin = user.role === 'super_admin';

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
        return isSuperAdmin ? <SuperAdminDashboard /> : null;
      case 'dashboard':
        return !isStudent ? (
          <DashboardHome
            onNavigate={(tab) => setActiveTab(tab)}
            onSelectStudent={navigateToStudentProfile}
          />
        ) : null;
      case 'register-student':
        return (
          <StudentRegistration
            onStudentRegistered={navigateToStudentProfile}
            onNavigateSearch={handleSearchStudents}
          />
        );
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
            onBack={() => setActiveTab(isStudent ? 'take-quiz' : 'students')}
            onAddScoreForStudent={navigateToAddScoreForStudent}
          />
        );
      case 'subjects':
        return <SubjectManager />;
      case 'question-generator':
        return (
          <AiQuestionGenerator
            onQuestionsSaved={() => setActiveTab('quizzes')}
            onNavigateQuizBuilder={() => setActiveTab('quizzes')}
          />
        );
      case 'quizzes':
        return <QuizBuilder onQuizCreated={() => setActiveTab('results')} />;
      case 'add-score':
        return (
          <AddScoreModal
            preselectedStudent={selectedStudent}
            onScoreSaved={() => setActiveTab('results')}
          />
        );
      case 'results':
        return <ResultsView />;
      case 'ss3-mock-student':
        return <SS3MockStudentDashboard />;
      case 'ss3-mock-teacher':
        return <SS3MockTeacherModule />;
      case 'take-quiz':
        return <StudentQuizTaker onCompleted={() => setActiveTab('student-profile')} />;
      default:
        return !isStudent ? (
          <DashboardHome
            onNavigate={(tab) => setActiveTab(tab)}
            onSelectStudent={navigateToStudentProfile}
          />
        ) : (
          <SS3MockStudentDashboard />
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
              onClick={() => setActiveTab(isStudent ? 'take-quiz' : 'dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="h-11 w-11 rounded-xl bg-white p-1 flex items-center justify-center shadow-md border border-amber-400/40 group-hover:scale-105 transition">
                <img
                  src={FIS_LOGOS.crest}
                  alt="FIS Crest"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-base tracking-tight block leading-tight">
                    Fenster International School
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    FENSTER
                  </span>
                </div>
                <span className="text-[11px] text-amber-300/90 font-medium block leading-tight">
                  Academic Assessment & Examination Portal
                </span>
              </div>
            </div>
          </div>

          {/* User profile & actions in navbar */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-white flex items-center justify-end gap-1.5">
                {user.firstName} {user.lastName || user.surname}
                {isSuperAdmin && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    SUPER ADMIN
                  </span>
                )}
                {isStudent && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    STUDENT
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isStudent ? `ID: ${user.studentId}` : isSuperAdmin ? 'Full System Authority' : `Faculty: ${user.teacherId || user.email}`}
              </span>
            </div>

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

      {/* Main Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0 space-y-6">
          <nav className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1 relative shadow-sm">
            
            {/* If Teacher or Super Admin */}
            {!isStudent && (
              <>
                {isSuperAdmin && (
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
                      Super Admin Console
                    </span>
                  </motion.button>
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
                    <UserPlus className="w-4 h-4 shrink-0" />
                    Register Student (Unique ID)
                  </span>
                </motion.button>

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
                    Results & Ledgers
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

            {/* If Student */}
            {isStudent && (
              <>
                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('ss3-mock-student')}
                  className={`w-full relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === 'ss3-mock-student'
                      ? 'text-slate-950 font-bold'
                      : 'text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  {activeTab === 'ss3-mock-student' && (
                    <motion.div
                      layoutId="activeSidebarIndicatorStudent"
                      className="absolute inset-0 bg-amber-500 rounded-xl shadow-md shadow-amber-500/20 z-0"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3">
                    <Award className={`w-4 h-4 shrink-0 ${activeTab === 'ss3-mock-student' ? 'text-slate-950' : 'text-amber-400'}`} />
                    Check SS3 Mock Result
                  </span>
                </motion.button>

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

                {!isStudent ? (
                  <>
                    {isSuperAdmin && (
                      <button
                        onClick={() => { setActiveTab('super-admin'); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold border transition ${
                          activeTab === 'super-admin'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-purple-950/60 text-purple-300 border-purple-800'
                        }`}
                      >
                        Super Admin Console
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
                    <button
                      onClick={() => { setActiveTab('register-student'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition ${
                        activeTab === 'register-student' ? 'bg-emerald-700 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Register Student (Unique ID)
                    </button>
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
                ) : (
                  <>
                    <button
                      onClick={() => { setActiveTab('ss3-mock-student'); setMobileMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg font-bold transition ${
                        activeTab === 'ss3-mock-student' ? 'bg-amber-500 text-slate-950' : 'text-amber-300 hover:bg-slate-700'
                      }`}
                    >
                      Check SS3 Mock Result (Over 400)
                    </button>
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
                      My Academic Record
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Main Workspace Area with Framer Motion Tab Transitions */}
        <main className="flex-1 min-w-0">
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
        </main>
      </div>
    </div>
  );
}

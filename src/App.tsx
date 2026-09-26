import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.tsx';
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
  ShieldAlert
} from 'lucide-react';
import { Student } from './types/index.ts';

export default function App() {
  const { user, token, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
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
    return <AuthModal onSuccess={() => setActiveTab(user?.role === 'student' ? 'take-quiz' : 'dashboard')} />;
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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div
              onClick={() => setActiveTab(isStudent ? 'take-quiz' : 'dashboard')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white text-base tracking-tight block leading-tight">
                  SQAMS
                </span>
                <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                  Assessment & Learning System
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
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    SUPER ADMIN
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isStudent ? `Student ID: ${user.studentId}` : isSuperAdmin ? 'Full Access: System Administrator' : `Teacher: ${user.teacherId || user.email}`}
              </span>
            </div>

            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
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
          <nav className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 space-y-1">
            
            {/* If Teacher or Super Admin */}
            {!isStudent && (
              <>
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab('super-admin')}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer mb-2 ${
                      activeTab === 'super-admin'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:bg-purple-900/50'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 text-purple-400" />
                    Super Admin Console
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('students')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'students'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  Students Directory
                </button>

                <button
                  onClick={() => setActiveTab('register-student')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'register-student'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Register Student (Unique ID)
                </button>

                <button
                  onClick={() => setActiveTab('subjects')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'subjects'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  Subjects Management
                </button>

                <button
                  onClick={() => setActiveTab('question-generator')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'question-generator'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                  AI Question Generator
                </button>

                <button
                  onClick={() => setActiveTab('quizzes')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'quizzes'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  Quiz / Test Builder
                </button>

                <button
                  onClick={() => setActiveTab('add-score')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'add-score'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  Add Student Score
                </button>

                <button
                  onClick={() => setActiveTab('results')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'results'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  Results & Ledgers
                </button>

                <div className="pt-2 border-t border-slate-700/60 my-1" />

                <button
                  onClick={() => setActiveTab('take-quiz')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'take-quiz'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  Student Exam Simulator
                </button>
              </>
            )}

            {/* If Student */}
            {isStudent && (
              <>
                <button
                  onClick={() => setActiveTab('take-quiz')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'take-quiz'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  Take Assigned Quizzes
                </button>

                <button
                  onClick={() => {
                    setSelectedStudent((user as any).studentProfile || null);
                    setActiveTab('student-profile');
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    activeTab === 'student-profile'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <Award className="w-4 h-4 shrink-0" />
                  My Academic Record
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur lg:hidden p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2 max-w-sm mx-auto mt-12">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                <span className="font-bold text-white text-sm">Navigation Menu</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!isStudent ? (
                <>
                  {isSuperAdmin && (
                    <button
                      onClick={() => { setActiveTab('super-admin'); setMobileMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg bg-purple-950/60 text-purple-300 font-bold border border-purple-800"
                    >
                      Super Admin Console
                    </button>
                  )}
                  <button
                    onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => { setActiveTab('students'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Students Directory
                  </button>
                  <button
                    onClick={() => { setActiveTab('register-student'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Register Student (Unique ID)
                  </button>
                  <button
                    onClick={() => { setActiveTab('subjects'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Subjects Management
                  </button>
                  <button
                    onClick={() => { setActiveTab('question-generator'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-amber-300 font-semibold"
                  >
                    AI Question Generator
                  </button>
                  <button
                    onClick={() => { setActiveTab('quizzes'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Quiz / Test Builder
                  </button>
                  <button
                    onClick={() => { setActiveTab('add-score'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Add Student Score
                  </button>
                  <button
                    onClick={() => { setActiveTab('results'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    Results & Ledgers
                  </button>
                  <button
                    onClick={() => { setActiveTab('take-quiz'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-emerald-400 font-semibold"
                  >
                    Student Exam Simulator
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setActiveTab('take-quiz'); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-emerald-400"
                  >
                    Take Assigned Quizzes
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStudent((user as any).studentProfile || null);
                      setActiveTab('student-profile');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-700 text-white"
                  >
                    My Academic Record
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Main Workspace Area */}
        <main className="flex-1 min-w-0">
          {activeTab === 'super-admin' && isSuperAdmin && (
            <SuperAdminDashboard />
          )}

          {activeTab === 'dashboard' && !isStudent && (
            <DashboardHome
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectStudent={navigateToStudentProfile}
            />
          )}

          {activeTab === 'register-student' && (
            <StudentRegistration
              onStudentRegistered={navigateToStudentProfile}
              onNavigateSearch={handleSearchStudents}
            />
          )}

          {activeTab === 'students' && (
            <StudentSearch
              initialQuery={searchInitialQuery}
              onSelectStudent={navigateToStudentProfile}
            />
          )}

          {activeTab === 'student-profile' && (
            <StudentProfile
              studentIdOrId={selectedStudent?.id || selectedStudent?.studentId || user?.studentId || 'FIS-2026-000001'}
              onBack={() => setActiveTab(isStudent ? 'take-quiz' : 'students')}
              onAddScoreForStudent={navigateToAddScoreForStudent}
            />
          )}

          {activeTab === 'subjects' && <SubjectManager />}

          {activeTab === 'question-generator' && (
            <AiQuestionGenerator
              onQuestionsSaved={() => setActiveTab('quizzes')}
              onNavigateQuizBuilder={() => setActiveTab('quizzes')}
            />
          )}

          {activeTab === 'quizzes' && (
            <QuizBuilder onQuizCreated={() => setActiveTab('results')} />
          )}

          {activeTab === 'add-score' && (
            <AddScoreModal
              preselectedStudent={selectedStudent}
              onScoreSaved={() => setActiveTab('results')}
            />
          )}

          {activeTab === 'results' && <ResultsView />}

          {activeTab === 'take-quiz' && (
            <StudentQuizTaker onCompleted={() => setActiveTab('student-profile')} />
          )}
        </main>
      </div>
    </div>
  );
}

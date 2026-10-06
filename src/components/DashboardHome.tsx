import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  Users,
  Layers,
  HelpCircle,
  FileCheck2,
  TrendingUp,
  Award,
  Clock,
  ArrowRight,
  PlusCircle,
  Sparkles,
  Search,
  School,
  GraduationCap,
  KeyRound
} from 'lucide-react';
import { Student } from '../types/index.ts';
import {
  getLocalStudents,
  fetchAllStudentsUnified,
  getLocalTeachers,
  fetchTeachersUnified,
} from '../lib/schoolStore.ts';

interface DashboardHomeProps {
  onNavigate: (tab: string) => void;
  onSelectStudent: (student: Student) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onNavigate,
  onSelectStudent,
}) => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 1,
    totalQuizzes: 0,
    totalQuestions: 0,
    totalAssessments: 0,
  });
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      // 1. Initial quick load from local caches
      const localStudents = getLocalStudents();
      const localTeachers = getLocalTeachers();
      setStats((prev) => ({
        ...prev,
        totalStudents: localStudents.length,
        totalTeachers: Math.max(localTeachers.length, 1),
      }));

      // 2. Fetch live data from backend & database
      try {
        const [res, liveStudents, liveTeachers] = await Promise.all([
          fetch('/api/dashboard/stats', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).catch(() => null),
          fetchAllStudentsUnified(token).catch(() => localStudents),
          fetchTeachersUnified(token).catch(() => localTeachers),
        ]);

        let serverStats: any = null;
        if (res && res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            const data = JSON.parse(text);
            serverStats = data.stats;
            if (data.recentResults) setRecentResults(data.recentResults);
            if (data.recentStudents) setRecentStudents(data.recentStudents);
          }
        }

        const resolvedStudents = Math.max(
          serverStats?.totalStudents || 0,
          (liveStudents || []).length,
          localStudents.length
        );
        const resolvedTeachers = Math.max(
          serverStats?.totalTeachers || serverStats?.totalStaff || 0,
          (liveTeachers || []).length,
          localTeachers.length,
          1
        );

        setStats({
          totalStudents: resolvedStudents,
          totalTeachers: resolvedTeachers,
          totalQuizzes: serverStats?.totalQuizzes || 0,
          totalQuestions: serverStats?.totalQuestions || 0,
          totalAssessments: serverStats?.totalAssessments || 0,
        });

        if (Array.isArray(liveStudents) && liveStudents.length > 0) {
          setRecentStudents(liveStudents.slice(0, 5));
        }
      } catch (e) {
        console.warn('Dashboard stats load fallback:', e);
      }
    }

    loadStats().finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 p-6 sm:p-8 rounded-2xl shadow-xl fis-card-accent relative overflow-hidden">
        {/* Crest watermark in background */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-56 w-auto" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <School className="w-4 h-4 text-amber-400" />
              <span>Fenster International School</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {user?.firstName} {user?.lastName || user?.surname}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Teacher ID: <strong className="text-amber-400 font-mono">{user?.teacherId || 'TCH-2026-0001'}</strong> • Academic Session 2026/2027. Manage enrollments, generate AI-grounded MCQs, and track academic results.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('ss3-mock-teacher')}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-300" />
              SS3 Mock Manager (/400)
            </button>
            <button
              onClick={() => onNavigate('question-generator')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              AI Question Generator
            </button>
            <button
              onClick={() => onNavigate('register-student')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition border border-slate-700 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Register Student
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('fis:open-change-password'))}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold rounded-xl text-xs flex items-center gap-2 transition border border-amber-500/30 cursor-pointer"
              title="Change your staff account password"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => onNavigate('students')}
          className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total Students</span>
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {stats.totalStudents}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Enrolled Scholars</span>
        </div>

        <div
          onClick={() => onNavigate(user?.role === 'super_admin' || user?.role === 'director' || user?.role === 'principal' || user?.role === 'admin' ? 'super-admin' : 'dashboard')}
          className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total Staff</span>
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 group-hover:scale-110 transition">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-2 font-mono">
            {stats.totalTeachers}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Faculty & Executives</span>
        </div>

        <div
          onClick={() => onNavigate('quizzes')}
          className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-purple-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total Quizzes</span>
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 group-hover:scale-110 transition">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {stats.totalQuizzes}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Created & Assigned</span>
        </div>

        <div
          onClick={() => onNavigate('question-generator')}
          className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-amber-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Question Bank</span>
            <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 group-hover:scale-110 transition">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {stats.totalQuestions}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">AI & Manual MCQs</span>
        </div>

        <div
          onClick={() => onNavigate('results')}
          className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-teal-500/50 transition group col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Assessments</span>
            <div className="p-2 rounded-xl bg-teal-600/20 text-teal-400 group-hover:scale-110 transition">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">
            {stats.totalAssessments}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">All Subjects</span>
        </div>
      </div>

      {/* Two Column Grid: Recent Results & Recently Registered Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Assessment Scores */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                Recent Assessment Scores
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Continuous assessments and online tests</p>
            </div>
            <button
              onClick={() => onNavigate('results')}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentResults.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No recent scores recorded yet. Add scores from the "Add Score" page.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {recentResults.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs">{r.studentName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400">
                        {r.studentId}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {r.subjectName} • {r.assessmentTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-white">
                      {r.score}/{r.maxScore}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.grade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                      r.grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                      r.grade === 'C' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-rose-500/20 text-rose-400'
                    }`}>
                      {r.grade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Registered Students */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Recently Registered Students
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Assigned unique admission IDs</p>
            </div>
            <button
              onClick={() => onNavigate('students')}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Browse All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No students enrolled yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {recentStudents.map((st) => (
                <div
                  key={st.id}
                  onClick={() => onSelectStudent(st)}
                  className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {st.firstName[0]}{st.surname[0]}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {st.firstName} {st.surname}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-mono text-emerald-400">{st.studentId}</span>
                        <span>• {st.currentClass}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1">
                    Profile
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

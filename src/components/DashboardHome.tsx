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
  School
} from 'lucide-react';
import { Student } from '../types/index.ts';

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
    totalQuizzes: 0,
    totalQuestions: 0,
    totalAssessments: 0,
  });
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
        if (data.recentResults) setRecentResults(data.recentResults);
        if (data.recentStudents) setRecentStudents(data.recentStudents);
      })
      .catch((e) => console.error('Dashboard stats error:', e))
      .finally(() => setLoading(false));
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
              onClick={() => onNavigate('question-generator')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              AI Question Generator
            </button>
            <button
              onClick={() => onNavigate('register-student')}
              className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition border border-emerald-600/50 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Register Student
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('students')}
          className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total Students</span>
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {stats.totalStudents}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">With permanent Unique IDs</span>
        </div>

        <div
          onClick={() => onNavigate('quizzes')}
          className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Total Quizzes</span>
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 group-hover:scale-110 transition">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {stats.totalQuizzes}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Created & Assigned</span>
        </div>

        <div
          onClick={() => onNavigate('question-generator')}
          className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Questions in Bank</span>
            <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 group-hover:scale-110 transition">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {stats.totalQuestions}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">AI & Manual MCQs</span>
        </div>

        <div
          onClick={() => onNavigate('results')}
          className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-medium">Assessments Recorded</span>
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 group-hover:scale-110 transition">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mt-3 font-mono">
            {stats.totalAssessments}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">All Subjects Combined</span>
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

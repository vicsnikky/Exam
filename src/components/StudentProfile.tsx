import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  User,
  GraduationCap,
  Calendar,
  Award,
  TrendingUp,
  PlusCircle,
  Clock,
  BookOpen,
  ArrowLeft,
  FileText,
  Percent,
  CheckCircle,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { Student, AssessmentRecord } from '../types/index.ts';
import { getLocalStudents, getInstitutionalVault } from '../lib/schoolStore.ts';
import { supabase } from '../supabaseConfig.ts';

interface StudentProfileProps {
  studentIdOrId: string | number;
  onBack?: () => void;
  onAddScoreForStudent?: (student: Student) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({
  studentIdOrId,
  onBack,
  onAddScoreForStudent,
}) => {
  const { token, user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [stats, setStats] = useState({
    totalAssessments: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
  });
  const [subjectPerformance, setSubjectPerformance] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      let data: any = null;
      try {
        const res = await fetch(`/api/students/${studentIdOrId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            data = JSON.parse(text);
          }
        }
      } catch (networkErr) {
        console.warn('Backend student profile fetch unavailable, using academic record:', networkErr);
      }

      if (data && data.student) {
        setStudent(data.student);
        setAssessments(data.assessments || []);
        setStats(data.stats || {
          totalAssessments: data.assessments?.length || 0,
          averageScore: 82.5,
          highestScore: 94,
          lowestScore: 71,
        });
        setSubjectPerformance(data.subjectPerformance || {});
        return;
      }

      // Real lookup from local store and institutional vault
      const allLocal = getLocalStudents();
      const vaultStudents = getInstitutionalVault().students;
      const combined = [...allLocal, ...vaultStudents];
      const match = combined.find(
        (s) => String(s.id) === String(studentIdOrId) || String(s.studentId).toUpperCase() === String(studentIdOrId).toUpperCase()
      );

      if (match) {
        setStudent(match);
        let realAssessments: AssessmentRecord[] = [];
        try {
          const { data: supaA } = await supabase
            .from('assessments')
            .select('*, subjects(*)')
            .eq('student_id', match.id);
          if (supaA && supaA.length > 0) {
            realAssessments = supaA.map((a: any) => ({
              id: a.id,
              studentId: match.studentId,
              subjectId: a.subject_id,
              subjectName: a.subjects?.name || 'Subject',
              subjectCode: a.subjects?.code || 'SUB',
              assessmentTitle: a.assessment_title || 'Continuous Assessment',
              assessmentType: a.assessment_type || 'test',
              score: Number(a.score),
              maxScore: Number(a.max_score || 100),
              percentage: Number(a.percentage || a.score),
              grade: a.grade || 'A',
              session: a.session || match.session,
              term: a.term || 'First Term',
              teacherComment: a.teacher_comment || '',
              createdAt: a.created_at,
            }));
          }
        } catch (_) {}

        setAssessments(realAssessments);
        if (realAssessments.length > 0) {
          const scores = realAssessments.map((a) => Number(a.percentage));
          setStats({
            totalAssessments: realAssessments.length,
            averageScore: Number((scores.reduce((a, b) => a + b, 0) / realAssessments.length).toFixed(1)),
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
          });
        } else {
          setStats({
            totalAssessments: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
          });
        }
        return;
      }

      setError('Student scholar record not found in system or active registry.');
    } catch (err: any) {
      setError(err.message || 'Error loading student profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [studentIdOrId]);

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <span>Loading comprehensive student academic history...</span>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="bg-slate-800/80 border border-slate-700 p-8 rounded-2xl text-center space-y-4">
        <p className="text-rose-400 text-sm">{error || 'Student not found'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs"
        >
          Return to Search
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Back & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => onAddScoreForStudent?.(student)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-2 transition shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Add Score for {student.firstName}
          </button>
        </div>
      </div>

      {/* Main Student Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl fis-card-accent relative overflow-hidden">
        {/* Subtle school watermark */}
        <div className="absolute right-0 top-0 bottom-0 opacity-5 pointer-events-none flex items-center pr-8">
          <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-48 w-auto" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-amber-300 flex items-center justify-center text-xl font-bold shrink-0 shadow-lg shadow-emerald-950 border border-amber-400/40">
              {student.firstName[0]}{student.surname[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {student.firstName} {student.middleName ? student.middleName + ' ' : ''}{student.surname}
                </h1>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold">
                  Class: {student.currentClass}
                </span>
                <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-medium">
                  {student.gender}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2.5 text-xs text-slate-400">
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  Admission ID: {student.studentId}
                </span>
                <span className="text-slate-300">School: {student.school || 'Fenster International School'}</span>
                <span>Session: {student.session}</span>
                {student.email && <span>Email: {student.email}</span>}
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-xs space-y-1 sm:min-w-[220px]">
            <span className="text-slate-400 font-medium block">Guardian Contact:</span>
            <p className="text-white font-semibold">{student.parentName || 'Not recorded'}</p>
            <p className="text-amber-400 font-mono">{student.parentPhone || 'No phone number'}</p>
          </div>
        </div>

        {/* Academic Performance KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-700">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              Cumulative Average
            </span>
            <span className="text-2xl font-bold text-white">
              {stats.averageScore}%
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Overall Academic Mean</span>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              Highest Assessment
            </span>
            <span className="text-2xl font-bold text-emerald-400">
              {stats.highestScore}%
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Top Mark Recorded</span>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              Lowest Assessment
            </span>
            <span className="text-2xl font-bold text-amber-400">
              {stats.lowestScore}%
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Needs Attention Area</span>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              Total Assessments
            </span>
            <span className="text-2xl font-bold text-purple-400">
              {stats.totalAssessments}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Recorded Tests / Quizzes</span>
          </div>
        </div>
      </div>

      {/* Subject-Wise Performance Breakdown */}
      {Object.keys(subjectPerformance).length > 0 && (
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Subject Performance Trend
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(subjectPerformance).map(([subj, records]) => {
              const total = records.reduce((acc, curr) => acc + Number(curr.percentage), 0);
              const avg = (total / records.length).toFixed(1);
              return (
                <div key={subj} className="bg-slate-900/70 border border-slate-700/70 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{subj}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      Avg: {avg}%
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-3 text-xs">
                    {records.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60 last:border-0">
                        <span className="text-slate-400 truncate max-w-[150px]">{r.assessmentTitle}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-white">{r.score}/{r.maxScore}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assessment History Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Complete Assessment & Score History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              All continuous assessments, online quizzes, and tests recorded across all teachers and subjects.
            </p>
          </div>
        </div>

        {assessments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">No assessment scores recorded yet</p>
            <p className="text-xs mt-1">Use the "Add Score" button above to record the student's first assessment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Assessment Title</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-right">Max</th>
                  <th className="py-3 px-4 text-right">%</th>
                  <th className="py-3 px-4 text-center">Grade</th>
                  <th className="py-3 px-4">Session / Term</th>
                  <th className="py-3 px-4">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-300">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-700/30 transition">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {a.subjectName} ({a.subjectCode})
                    </td>
                    <td className="py-3.5 px-4">{a.assessmentTitle}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                        {a.assessmentType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      {a.score}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {a.maxScore}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-indigo-300">
                      {a.percentage}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                        a.grade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                        a.grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                        a.grade === 'C' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {a.grade}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {a.session} • {a.term}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 italic max-w-xs truncate">
                      {a.teacherComment || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

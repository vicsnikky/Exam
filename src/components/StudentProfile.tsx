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
  Loader2,
  Printer,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Student, AssessmentRecord } from '../types/index.ts';
import { getLocalStudents, getInstitutionalVault, fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import { supabase } from '../supabaseConfig.ts';
import { isStudentFeeLocked, getStudentFeeLockDetails } from '../lib/bursarStore.ts';
import { FeeWithheldNotice } from './FeeWithheldNotice.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

interface StudentProfileProps {
  studentIdOrId: string | number;
  initialStudent?: Student;
  onBack?: () => void;
  onAddScoreForStudent?: (student: Student) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({
  studentIdOrId,
  initialStudent,
  onBack,
  onAddScoreForStudent,
}) => {
  const { token, user } = useAuth();
  const isStudent = user?.role === 'student';
  const isBursar = user?.role === 'bursar';
  const canAddScore = !isStudent && !isBursar && Boolean(onAddScoreForStudent);

  const [student, setStudent] = useState<Student | null>(initialStudent || null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [mockScores, setMockScores] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalAssessments: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0,
  });
  const [subjectPerformance, setSubjectPerformance] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(!initialStudent);
  const [error, setError] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'assessments' | 'mock-results' | 'printable-slip'>('assessments');

  const loadProfile = async () => {
    if (!initialStudent) {
      setLoading(true);
    }
    setError(null);
    try {
      let resolvedStudent: Student | null = initialStudent || null;
      let realAssessments: AssessmentRecord[] = [];
      let realMockScores: any[] = [];

      // 1. Try Backend student profile endpoint
      try {
        const res = await fetch(`/api/students/${encodeURIComponent(String(studentIdOrId))}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            const data = JSON.parse(text);
            if (data && data.student) {
              resolvedStudent = data.student;
              if (Array.isArray(data.assessments)) {
                realAssessments = data.assessments;
              }
              if (data.subjectPerformance && typeof data.subjectPerformance === 'object') {
                setSubjectPerformance(data.subjectPerformance);
              }
            }
          }
        }
      } catch (networkErr) {
        console.warn('Backend student profile fetch fallback:', networkErr);
      }

      // 2. If student still not resolved, check unified store & local vault
      if (!resolvedStudent) {
        try {
          const allUnified = await fetchAllStudentsUnified(token);
          const match = allUnified.find(
            (s) =>
              String(s.id) === String(studentIdOrId) ||
              String(s.studentId).toUpperCase() === String(studentIdOrId).toUpperCase()
          );
          if (match) resolvedStudent = match;
        } catch (_) {}
      }

      if (!resolvedStudent) {
        const allLocal = getLocalStudents();
        const vaultStudents = getInstitutionalVault().students || [];
        const combined = [...allLocal, ...vaultStudents];
        const match = combined.find(
          (s) =>
            String(s.id) === String(studentIdOrId) ||
            String(s.studentId).toUpperCase() === String(studentIdOrId).toUpperCase()
        );
        if (match) resolvedStudent = match;
      }

      // 3. If still not resolved, query Supabase students table directly
      if (!resolvedStudent) {
        try {
          const isNumeric = !isNaN(Number(studentIdOrId));
          const query = supabase.from('students').select('*');
          const { data: supaStudents } = isNumeric
            ? await query.eq('id', Number(studentIdOrId)).limit(1)
            : await query.eq('student_id', String(studentIdOrId).toUpperCase().trim()).limit(1);

          if (supaStudents && supaStudents.length > 0) {
            const row = supaStudents[0];
            resolvedStudent = {
              id: row.id,
              studentId: row.student_id,
              firstName: row.first_name,
              middleName: row.middle_name || '',
              surname: row.surname,
              currentClass: row.current_class,
              gender: row.gender || 'Not specified',
              session: row.session || '2026/2027',
              school: row.school || 'Fenster International School',
              parentName: row.parent_name || '',
              parentPhone: row.parent_phone || '',
              email: row.email || '',
              createdAt: row.created_at || new Date().toISOString(),
            };
          }
        } catch (supaErr) {
          console.warn('Supabase student lookup fallback:', supaErr);
        }
      }

      // If resolved, load continuous assessments and mock results
      if (resolvedStudent) {
        setStudent(resolvedStudent);

        // Fetch regular assessments from Supabase if not yet provided by backend
        if (realAssessments.length === 0) {
          try {
            const { data: supaA } = await supabase
              .from('assessments')
              .select('*, subjects(*)')
              .eq('student_id', resolvedStudent.id);

            if (supaA && supaA.length > 0) {
              realAssessments = supaA.map((a: any) => ({
                id: a.id,
                studentId: resolvedStudent!.studentId,
                subjectId: a.subject_id,
                subjectName: a.subjects?.name || 'Subject',
                subjectCode: a.subjects?.code || 'SUB',
                assessmentTitle: a.assessment_title || 'Continuous Assessment',
                assessmentType: a.assessment_type || 'test',
                score: Number(a.score) || 0,
                maxScore: Number(a.max_score || 100),
                percentage: Number(a.percentage || a.score || 0),
                grade: a.grade || 'A',
                session: a.session || resolvedStudent!.session,
                term: a.term || 'First Term',
                teacherComment: a.teacher_comment || '',
                createdAt: a.created_at,
              }));
            }
          } catch (_) {}
        }

        // Fetch SS3 Mock scores from Supabase ss3_mock_scores and assessments
        try {
          const { data: supaMocks } = await supabase
            .from('ss3_mock_scores')
            .select('*, subjects(*)')
            .eq('student_id', resolvedStudent.id);

          if (supaMocks && supaMocks.length > 0) {
            realMockScores = supaMocks.map((m: any) => ({
              id: m.id,
              studentId: resolvedStudent!.studentId,
              subjectId: m.subject_id,
              subjectName: m.subjects?.name || 'Mock Subject',
              subjectCode: m.subjects?.code || 'SS3 CORE',
              weekNumber: m.week_number || 1,
              score: Number(m.score) || 0,
              maxScore: Number(m.max_score) || 100,
              percentage: Number(m.percentage) || Number(m.score) || 0,
              grade: m.grade || 'C4',
              remark: m.remark || 'Satisfactory',
            }));
          }
        } catch (_) {}

        // Filter out subjects the student did not sit for (score must be > 0 or percentage > 0)
        realAssessments = realAssessments.filter((a) => (Number(a.score) > 0 || Number(a.percentage) > 0));
        realMockScores = realMockScores.filter((m) => (Number(m.score) > 0 || Number(m.percentage) > 0));

        setAssessments(realAssessments);
        setMockScores(realMockScores);

        // Calculate statistics safely
        if (realAssessments.length > 0) {
          const validScores = realAssessments
            .map((a) => Number(a.percentage))
            .filter((n) => !isNaN(n) && isFinite(n));

          if (validScores.length > 0) {
            const sum = validScores.reduce((acc, curr) => acc + curr, 0);
            const avg = Number((sum / validScores.length).toFixed(1));
            setStats({
              totalAssessments: realAssessments.length,
              averageScore: avg,
              highestScore: Math.max(...validScores),
              lowestScore: Math.min(...validScores),
            });
          }
        }

        // Build subject performance map if not already populated
        const map: Record<string, any[]> = {};
        realAssessments.forEach((a) => {
          const sName = a.subjectName || 'General';
          if (!map[sName]) map[sName] = [];
          map[sName].push(a);
        });
        setSubjectPerformance(map);
      } else {
        setError('Student scholar record not found in system or active registry.');
      }
    } catch (err: any) {
      console.error('Error loading student profile:', err);
      setError(err?.message || 'Error loading student profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [studentIdOrId]);

  if (loading && !student) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Loading comprehensive student academic profile & results...</span>
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-4 max-w-lg mx-auto shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <p className="text-rose-400 text-sm font-semibold">{error || 'Student record could not be loaded'}</p>
        <p className="text-xs text-slate-400">
          The requested student record is not available or has not been synced to the current session.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition"
          >
            Return to Directory
          </button>
        )}
      </div>
    );
  }

  if (!student) return null;

  // Fee Lock Check (Applies to terminal continuous assessments & report slips. JAMB mock results do not need clearing)
  const studentKey = student.studentId || String(student.id || studentIdOrId);
  const isLockedForFees = isStudentFeeLocked(studentKey) || isStudentFeeLocked(student.id) || isStudentFeeLocked(student.email);
  const lockDetails = isLockedForFees ? (getStudentFeeLockDetails(studentKey) || getStudentFeeLockDetails(student.id)) : null;

  const isSS3 = (student.currentClass || '').toUpperCase().includes('SS 3') || (student.currentClass || '').toUpperCase().includes('SS3');

  return (
    <ErrorBoundary fallbackTitle="Student Profile Recovery">
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
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              Print Record
            </button>
            {canAddScore && (
              <button
                onClick={() => onAddScoreForStudent?.(student)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-900/40 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-amber-300" />
                Add Score for {student.firstName}
              </button>
            )}
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
                {(student.firstName?.[0] || 'S')}{(student.surname?.[0] || 'C')}
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
                    {student.gender || 'Scholar'}
                  </span>
                  {isLockedForFees ? (
                    <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-[11px] font-bold">
                      🔒 Results Withheld (School Fees Unpaid)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[11px] font-bold">
                      🟢 Financially Cleared
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2.5 text-xs text-slate-400">
                  <span className="font-mono text-emerald-400 font-bold text-sm">
                    Admission ID: {student.studentId}
                  </span>
                  <span className="text-slate-300">School: {student.school || 'Fenster International School'}</span>
                  <span>Session: {student.session || '2026/2027'}</span>
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
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
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
              <span className="text-[11px] text-slate-400 block mt-0.5">Continuous Assessments</span>
            </div>
          </div>
        </div>

        {/* View Switcher: Assessments vs SS3 Mock Results vs Printable Report */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setProfileTab('assessments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              profileTab === 'assessments'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Terminal Assessments & Tests ({assessments.length})
          </button>

          {isSS3 && (
            <button
              onClick={() => setProfileTab('mock-results')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                profileTab === 'mock-results'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
                  : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              SS3 Mock Results & Aggregate
            </button>
          )}

          <button
            onClick={() => setProfileTab('printable-slip')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              profileTab === 'printable-slip'
                ? 'bg-indigo-700 text-white shadow-md shadow-indigo-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-indigo-300" />
            Official Result Slip
          </button>
        </div>

        {/* TAB 1: CONTINUOUS ASSESSMENTS */}
        {profileTab === 'assessments' && (
          isStudent && isLockedForFees ? (
            <div className="space-y-4">
              <FeeWithheldNotice
                studentName={`${student.firstName} ${student.surname}`}
                studentId={student.studentId}
                reason={lockDetails?.reason || 'Outstanding tuition / school fees for the current academic session'}
              />
              {isSS3 && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-center text-xs text-emerald-300 space-y-2">
                  <p className="font-semibold">
                    💡 Official Notice: SS3 JAMB Mock Examination Results do not require bursary clearance and are exempt from fee restriction.
                  </p>
                  <button
                    onClick={() => setProfileTab('mock-results')}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-emerald-950"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-300" />
                    Switch to SS3 Mock Results Tab
                  </button>
                </div>
              )}
            </div>
          ) : (
          <div className="space-y-6">
            {/* Subject-Wise Breakdown */}
            {Object.keys(subjectPerformance).length > 0 && (
              <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  Subject Performance Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(subjectPerformance).map(([subj, records]) => {
                    const validRecords = Array.isArray(records) ? records : [];
                    const total = validRecords.reduce(
                      (acc, curr) => acc + (Number(curr?.percentage) || 0),
                      0
                    );
                    const avg = validRecords.length > 0 ? (total / validRecords.length).toFixed(1) : '0';
                    return (
                      <div key={subj} className="bg-slate-900/70 border border-slate-700/70 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-white text-sm">{subj}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Avg: {avg}%
                          </span>
                        </div>
                        <div className="space-y-1.5 mt-3 text-xs">
                          {validRecords.map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60 last:border-0">
                              <span className="text-slate-400 truncate max-w-[150px]">{r.assessmentTitle || 'Test'}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-white">{r.score}/{r.maxScore}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.grade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                                  r.grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                                  r.grade === 'C' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-rose-500/20 text-rose-400'
                                }`}>
                                  {r.grade || 'C'}
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
                    <Clock className="w-4 h-4 text-emerald-400" />
                    Complete Assessment & Score History
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Continuous assessments, periodic tests, and examination records recorded for this scholar.
                  </p>
                </div>
              </div>

              {assessments.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">No continuous assessment scores recorded yet</p>
                  <p className="text-xs mt-1">
                    {canAddScore ? 'Click "Add Score" above to record the scholar\'s first assessment.' : 'Scores will appear here once submitted by subject teachers.'}
                  </p>
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
                        <th className="py-3 px-4">Remarks</th>
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
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
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
          )
        )}

        {/* TAB 2: SS3 MOCK RESULTS */}
        {profileTab === 'mock-results' && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  SS3 UTME Mock Examination Records (Scaled / 400)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official weekly mock trajectory. Standard aggregate is calculated across exactly 4 accepted subjects.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Admission Benchmark</span>
                <span className="text-xs font-bold text-amber-300">Aiming for 300+ Elite Score</span>
              </div>
            </div>

            {mockScores.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Award className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No SS3 Mock scores recorded yet for this student</p>
                <p className="text-xs mt-1">
                  Mock examinations entered through the SS3 Weekly Mock module will populate here automatically.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Week</th>
                      <th className="py-3 px-4 text-right">Feasible Score (/100)</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                      <th className="py-3 px-4">Registrar's Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-300">
                    {mockScores.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {m.subjectName} ({m.subjectCode})
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">Week {m.weekNumber}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                          {m.score} / 100
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 text-[10px]">
                            {m.grade}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 italic">
                          {m.remark}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: OFFICIAL PRINTABLE RESULT SLIP */}
        {profileTab === 'printable-slip' && (
          isStudent && isLockedForFees ? (
            <div className="space-y-4">
              <FeeWithheldNotice
                studentName={`${student.firstName} ${student.surname}`}
                studentId={student.studentId}
                reason={lockDetails?.reason || 'Outstanding tuition / school fees for the current academic session'}
              />
            </div>
          ) : (
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
            {/* Header with Crest */}
            <div className="flex flex-col items-center text-center pb-6 border-b-2 border-emerald-600 print:border-black">
              <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-20 w-auto mb-2 object-contain" />
              <h2 className="text-xl sm:text-2xl font-black text-white print:text-black tracking-tight uppercase">
                Fenster International School
              </h2>
              <span className="text-xs text-amber-400 print:text-slate-800 font-semibold uppercase tracking-wider">
                Excellence in Academics & Moral Discipline • Institutional Examination Registry
              </span>
              <span className="text-[11px] text-slate-400 print:text-slate-600 mt-1">
                Official Scholar Transcript & Academic Performance Certificate
              </span>
            </div>

            {/* Student Metadata Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6 p-4 bg-slate-950/80 print:bg-slate-100 rounded-2xl border border-slate-800 print:border-slate-300 text-xs">
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Scholar Name</span>
                <strong className="text-white print:text-black text-sm">{student.firstName} {student.surname}</strong>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Admission ID</span>
                <strong className="font-mono text-emerald-400 print:text-emerald-900">{student.studentId}</strong>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Class / Session</span>
                <strong className="text-white print:text-black">{student.currentClass} • {student.session || '2026/2027'}</strong>
              </div>
              <div>
                <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Financial Clearance</span>
                <span className="font-bold text-emerald-400 print:text-emerald-900">
                  {isLockedForFees ? 'Pending Clearance' : 'Cleared by Bursary'}
                </span>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto my-6">
              <table className="w-full text-left text-xs border border-slate-800 print:border-black">
                <thead className="bg-slate-800 print:bg-slate-200 text-slate-300 print:text-black font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black">Subject</th>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black text-center">Assessment</th>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black text-right">Score</th>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black text-right">Max</th>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black text-right">%</th>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black text-center">Grade</th>
                    <th className="py-2.5 px-3 border border-slate-700 print:border-black">Registrar's Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 print:divide-black">
                  {assessments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No continuous assessment scores recorded yet for this session.
                      </td>
                    </tr>
                  ) : (
                    assessments.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2.5 px-3 font-semibold text-white print:text-black border border-slate-800 print:border-black">
                          {a.subjectName}
                        </td>
                        <td className="py-2.5 px-3 text-center border border-slate-800 print:border-black">
                          {a.assessmentTitle}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white print:text-black border border-slate-800 print:border-black">
                          {a.score}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono border border-slate-800 print:border-black">
                          {a.maxScore}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400 print:text-black border border-slate-800 print:border-black">
                          {a.percentage}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold border border-slate-800 print:border-black">
                          {a.grade}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 print:text-slate-800 italic border border-slate-800 print:border-black">
                          {a.teacherComment || 'Satisfactory'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Signatures */}
            <div className="mt-12 pt-6 border-t border-slate-700 print:border-black flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 print:text-slate-800 gap-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-emerald-400 print:text-black" />
                <div>
                  <strong className="text-white print:text-black block text-sm">
                    Fenster International School Official Registry
                  </strong>
                  <span className="text-[11px]">
                    Validated against Master Ledger • Issued on {new Date().toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>

              <div className="flex items-end gap-12 text-center">
                <div>
                  <div className="w-32 border-b border-slate-600 print:border-black mb-1.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 print:text-black block">
                    Registrar
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <img
                    src="https://i.ibb.co/MzHp6Yt/Whats-App-Image-2026-10-02-at-11-29-34-AM.jpg"
                    alt="Principal Signature"
                    className="h-12 w-auto object-contain mb-1 filter contrast-125 print:mix-blend-multiply"
                  />
                  <div className="w-36 border-b border-slate-600 print:border-black mb-1.5" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 print:text-black block">
                    Principal
                  </span>
                </div>
              </div>
            </div>
          </div>
          )
        )}
      </div>
    </ErrorBoundary>
  );
};

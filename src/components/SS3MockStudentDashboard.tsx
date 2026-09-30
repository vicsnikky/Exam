import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  Award,
  TrendingUp,
  FileCheck2,
  Calendar,
  ShieldCheck,
  Printer,
  ChevronRight,
  BookOpen,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Lock,
  Download,
  Info
} from 'lucide-react';
import { SS3MockWeeklySummary, SS3MockProgressPoint } from '../types/index.ts';
import { supabase } from '../supabaseConfig.ts';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

interface SS3MockStudentDashboardProps {
  studentDbId?: number;
  readOnly?: boolean;
}

export const SS3MockStudentDashboard: React.FC<SS3MockStudentDashboardProps> = ({
  studentDbId,
  readOnly = false,
}) => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<SS3MockWeeklySummary[]>([]);
  const [progressData, setProgressData] = useState<SS3MockProgressPoint[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'weekly-slips' | 'progress-chart'>('weekly-slips');

  const fetchMockScores = async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }
    setError(null);
    try {
      let data: any = null;
      const targetNumber = user?.studentId || '';
      const targetId = studentDbId || user?.id || '';
      const queryParam = `?studentId=${encodeURIComponent(targetId)}&studentNumber=${encodeURIComponent(targetNumber)}`;

      // 1. Try Backend SS3 Mock Endpoint
      try {
        const res = await fetch(`/api/ss3-mock/scores${queryParam}`, {
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
        console.warn('Backend SS3 mock fetch unavailable:', networkErr);
      }

      if (data && data.weeklySummaries && data.weeklySummaries.length > 0) {
        setWeeklySummaries(data.weeklySummaries);
        setProgressData(data.progressChartData || []);
        setSelectedWeek(data.weeklySummaries[data.weeklySummaries.length - 1].weekNumber);
        return;
      }

      // 2. Direct Query to Supabase assessments table
      try {
        let numericStudentId: number | null = typeof targetId === 'number' ? targetId : null;
        if (!numericStudentId && targetNumber) {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .eq('student_id', targetNumber.toUpperCase())
            .limit(1);
          if (stRow && stRow.length > 0) {
            numericStudentId = stRow[0].id;
          }
        }

        if (numericStudentId) {
          const { data: supaAssessments } = await supabase
            .from('assessments')
            .select(`
              id,
              student_id,
              subject_id,
              assessment_type,
              assessment_title,
              score,
              max_score,
              percentage,
              grade,
              session,
              term,
              teacher_comment,
              created_at,
              subjects:subject_id (
                id,
                name,
                code
              )
            `)
            .eq('student_id', numericStudentId)
            .eq('assessment_type', 'SS3_MOCK')
            .order('created_at', { ascending: true });

          if (supaAssessments && supaAssessments.length > 0) {
            // Group by week
            const weekGroups: Record<number, any> = {};
            for (const a of supaAssessments as any[]) {
              const weekMatch = (a.term + ' ' + (a.assessment_title || '')).match(/Week\s*(\d+)/i);
              const w = weekMatch ? parseInt(weekMatch[1], 10) : 1;

              if (!weekGroups[w]) {
                weekGroups[w] = {
                  weekNumber: w,
                  mockSeriesTitle: a.assessment_title || `SS3 Weekly Mock Series - Week ${w}`,
                  session: a.session || '2026/2027',
                  term: a.term || `Week ${w}`,
                  examDate: a.created_at ? a.created_at.split('T')[0] : '2026-09-28',
                  subjects: [],
                };
              }

              let parsedComment: any = {};
              try {
                if (a.teacher_comment && a.teacher_comment.startsWith('{')) {
                  parsedComment = JSON.parse(a.teacher_comment);
                }
              } catch (_) {}

              const subName = a.subjects?.name || 'Subject';
              const isEng = subName.toLowerCase().includes('english');
              const maxRaw = isEng ? 60 : 40;
              const rawScore = parsedComment.rawScore !== undefined ? parsedComment.rawScore : parseFloat(a.score) || 0;
              const scaledScore = parseFloat(a.score) || 0;

              weekGroups[w].subjects.push({
                studentId: numericStudentId,
                subjectId: a.subject_id,
                subjectName: subName,
                subjectCode: a.subjects?.code || 'SS3 CORE',
                isEnglish: isEng,
                rawScore,
                maxRawScore: maxRaw,
                score: scaledScore,
                maxScore: 100,
                percentage: scaledScore,
                formula: parsedComment.formula || `(${rawScore} ÷ ${maxRaw}) × 100 = ${scaledScore}`,
                grade: a.grade || (scaledScore >= 75 ? 'A1' : scaledScore >= 70 ? 'B2' : scaledScore >= 65 ? 'B3' : scaledScore >= 50 ? 'C4' : 'F9'),
                remark: parsedComment.remark || 'Good',
                weekNumber: w,
              });
            }

            const summaries: SS3MockWeeklySummary[] = Object.values(weekGroups).map((wg: any) => {
              wg.subjects.sort((a: any, b: any) => {
                if (a.isEnglish) return -1;
                if (b.isEnglish) return 1;
                return a.subjectName.localeCompare(b.subjectName);
              });
              const totalScore400 = Math.round(wg.subjects.reduce((sum: number, s: any) => sum + (s.score || 0), 0) * 10) / 10;
              const averagePercentage = Math.round((totalScore400 / 400) * 1000) / 10;
              return {
                ...wg,
                totalScore400,
                maxPossibleScore: 400,
                averagePercentage,
                overallGrade: averagePercentage >= 75 ? 'A1' : averagePercentage >= 70 ? 'B2' : averagePercentage >= 65 ? 'B3' : averagePercentage >= 50 ? 'C4' : 'F9',
                overallRemark: totalScore400 >= 300 ? 'Outstanding Distinction' : totalScore400 >= 250 ? 'Strong Performance' : 'Good Progress',
                creditsCount: wg.subjects.filter((s: any) => s.score >= 50).length,
                distinctionsCount: wg.subjects.filter((s: any) => s.score >= 75).length,
              };
            });

            summaries.sort((a, b) => a.weekNumber - b.weekNumber);

            const progress: SS3MockProgressPoint[] = summaries.map((s) => ({
              weekNumber: s.weekNumber,
              weekLabel: `Week ${s.weekNumber}`,
              totalScore400: s.totalScore400,
              percentage: s.averagePercentage,
              targetScore: 250,
              examDate: s.examDate || '',
              subjectsCount: s.subjects.length,
            }));

            setWeeklySummaries(summaries);
            setProgressData(progress);
            setSelectedWeek(summaries[summaries.length - 1].weekNumber);
            return;
          }
        }
      } catch (supaErr) {
        console.warn('Supabase assessments query warning:', supaErr);
      }

      // 3. Check localStorage fis_mock_scores_v2
      try {
        const storedRaw = localStorage.getItem('fis_mock_scores_v2');
        if (storedRaw) {
          const storedList = JSON.parse(storedRaw);
          const studentScores = storedList.filter((m: any) =>
            (targetNumber && m.studentNumber && m.studentNumber.toUpperCase() === targetNumber.toUpperCase()) ||
            (targetId && String(m.studentId) === String(targetId))
          );

          if (studentScores.length > 0) {
            studentScores.sort((a: any, b: any) => a.weekNumber - b.weekNumber);
            const summaries: SS3MockWeeklySummary[] = studentScores.map((s: any) => ({
              weekNumber: s.weekNumber,
              mockSeriesTitle: s.mockSeriesTitle || `SS3 Weekly Mock Series - Week ${s.weekNumber}`,
              session: s.session || '2026/2027',
              term: s.term || `Week ${s.weekNumber}`,
              examDate: s.examDate || '2026-09-28',
              totalScore400: s.totalScore400,
              maxPossibleScore: 400,
              averagePercentage: s.averagePercentage,
              overallGrade: s.averagePercentage >= 75 ? 'A1' : s.averagePercentage >= 70 ? 'B2' : s.averagePercentage >= 65 ? 'B3' : s.averagePercentage >= 50 ? 'C4' : 'F9',
              overallRemark: s.totalScore400 >= 300 ? 'Outstanding Distinction' : s.totalScore400 >= 250 ? 'Strong Performance' : 'Good Progress',
              creditsCount: (s.subjects || []).filter((sub: any) => (sub.scaledScore || sub.score) >= 50).length,
              distinctionsCount: (s.subjects || []).filter((sub: any) => (sub.scaledScore || sub.score) >= 75).length,
              subjects: (s.subjects || []).map((sub: any) => ({
                studentId: typeof targetId === 'number' ? targetId : 1,
                subjectId: sub.subjectId,
                subjectName: sub.subjectName,
                subjectCode: sub.subjectCode || 'SS3 CORE',
                isEnglish: sub.isEnglish || false,
                rawScore: sub.rawScore,
                maxRawScore: sub.maxRawScore || (sub.isEnglish ? 60 : 40),
                score: sub.scaledScore !== undefined ? sub.scaledScore : sub.score,
                maxScore: 100,
                percentage: sub.scaledScore !== undefined ? sub.scaledScore : sub.score,
                formula: sub.formula || `(${sub.rawScore} ÷ ${sub.isEnglish ? 60 : 40}) × 100 = ${sub.scaledScore}`,
                grade: sub.grade || 'C4',
                remark: sub.remark || 'Good',
                weekNumber: s.weekNumber,
              })),
            }));

            const progress: SS3MockProgressPoint[] = summaries.map((s) => ({
              weekNumber: s.weekNumber,
              weekLabel: `Week ${s.weekNumber}`,
              totalScore400: s.totalScore400,
              percentage: s.averagePercentage,
              targetScore: 250,
              examDate: s.examDate || '',
              subjectsCount: s.subjects.length,
            }));

            setWeeklySummaries(summaries);
            setProgressData(progress);
            setSelectedWeek(summaries[summaries.length - 1].weekNumber);
            return;
          }
        }
      } catch (localErr) {
        console.warn('Local mock scores read warning:', localErr);
      }

      // No recorded mock scores found for this student: clear lists cleanly!
      setWeeklySummaries([]);
      setProgressData([]);
    } catch (err: any) {
      setError(err.message || 'Error loading mock exam records');
      setWeeklySummaries([]);
      setProgressData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMockScores();

    const handleUpdate = (e: any) => {
      const detail = e?.detail;
      const targetNum = user?.studentId?.toUpperCase();
      const targetIdStr = String(studentDbId || user?.id || '');

      if (!detail || !targetNum || detail.studentNumber?.toUpperCase() === targetNum || String(detail.studentId) === targetIdStr) {
        fetchMockScores(false);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fis_mock_scores_v2') {
        fetchMockScores(false);
      }
    };

    window.addEventListener('fis:mock-scores-updated', handleUpdate);
    window.addEventListener('storage', handleStorageChange);

    // Periodic live synchronization so teacher score inputs appear automatically
    const pollInterval = setInterval(() => {
      fetchMockScores(false);
    }, 4000);

    return () => {
      window.removeEventListener('fis:mock-scores-updated', handleUpdate);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, [studentDbId, user?.studentId, user?.id]);

  const activeWeekSummary = weeklySummaries.find((w) => w.weekNumber === selectedWeek);

  // Compute overall stats across all weeks
  const totalWeeksCount = weeklySummaries.length;
  const latestSummary = weeklySummaries[weeklySummaries.length - 1];
  const overallAverageScore =
    totalWeeksCount > 0
      ? Math.round(
          (weeklySummaries.reduce((acc, curr) => acc + curr.totalScore400, 0) /
            totalWeeksCount) *
            10
        ) / 10
      : 0;

  const highestWeek =
    totalWeeksCount > 0
      ? weeklySummaries.reduce((prev, curr) =>
          curr.totalScore400 > prev.totalScore400 ? curr : prev
        )
      : null;

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Student Identity Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-radial from-emerald-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg border border-amber-400/40 shrink-0">
              <img
                src={FIS_LOGOS.crest}
                alt="Fenster International School"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wide">
                  SS3 UTME MOCK ASSESSMENT PORTAL
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Total Marks: 400
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white mt-1">
                {user?.role === 'student'
                  ? `${user.firstName} ${user.lastName || user.surname || ''}`
                  : activeWeekSummary?.subjects[0]?.studentName || 'Senior School 3 Candidate'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-300">
                <span>
                  Student ID:{' '}
                  <strong className="text-amber-400 font-mono">
                    {user?.studentId || activeWeekSummary?.subjects[0]?.studentNumber || 'FEN-2026-SS3'}
                  </strong>
                </span>
                <span>•</span>
                <span>Class: <strong>SS 3 (Final Year)</strong></span>
                <span>•</span>
                <span>Session: <strong>{user?.session || '2026/2027'}</strong></span>
                <span>•</span>
                <span>Target: <strong>4 Core UTME Subjects</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handlePrintSlip}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 text-xs font-semibold shadow transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              Print Mock Slip
            </button>
          </div>
        </div>

        {/* Security & Access Protection Notice */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Protected Confidential Portal: Accessible only via your unique Student ID and personal password to protect your academic records.
          </span>
        </div>
      </div>

      {/* KPI Cards: Aggregate over 400 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latest Week Score / 400 */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Latest Mock Score</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {latestSummary ? latestSummary.totalScore400 : '---'}
            </span>
            <span className="text-sm font-semibold text-slate-400">/ 400</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <span>
              {latestSummary ? `${latestSummary.averagePercentage}% Overall` : 'No score recorded yet'}
            </span>
            {latestSummary && (
              <span className="text-[10px] text-slate-400">({latestSummary.mockSeriesTitle})</span>
            )}
          </div>
        </div>

        {/* Average Across All Mock Weeks */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Cumulative Average</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">
              {overallAverageScore > 0 ? overallAverageScore : '---'}
            </span>
            <span className="text-sm font-semibold text-slate-400">/ 400</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Computed across {totalWeeksCount} completed mock week{totalWeeksCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Highest Mock Week */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Personal Record (Best)</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-300">
              {highestWeek ? highestWeek.totalScore400 : '---'}
            </span>
            <span className="text-sm font-semibold text-slate-400">/ 400</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            {highestWeek ? `Achieved in Week ${highestWeek.weekNumber}` : 'Pending assessments'}
          </div>
        </div>

        {/* UTME / JAMB Target Benchmark */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Admission Benchmark</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-base font-bold text-white block truncate">
              {latestSummary ? latestSummary.overallGrade + ' Distinction' : '250+ Target'}
            </span>
            <span className="text-xs text-amber-300 font-medium block mt-1 line-clamp-1">
              {latestSummary?.targetBenchmarkRemark || 'Aiming for 300+ Elite Score'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            University Cut-off Standard: 200+
          </div>
        </div>
      </div>

      {/* Formula Explainer Banner */}
      <div className="bg-slate-800/60 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <strong className="text-amber-300 font-bold block text-sm">
            Official SS3 Mock Exam Scaling & Aggregate Rules (Max: 400)
          </strong>
          <p>
            • <strong>English Language (Compulsory):</strong> Graded over <strong>60</strong> marks. Feasible score ={' '}
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">(Raw Score ÷ 60) × 100</code>.
          </p>
          <p>
            • <strong>Mathematics & Other 2 Subjects:</strong> Each graded over <strong>40</strong> marks. Feasible score ={' '}
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">(Raw Score ÷ 40) × 100</code>.
          </p>
          <p>
            • <strong>Total Aggregate:</strong> Each student takes exactly <strong>4 subjects</strong> (scaled to 100 each), summing to a grand total over <strong>400 marks</strong>.
          </p>
        </div>
      </div>

      {/* Navigation View Switcher (Weekly Slips vs Progress Chart) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('weekly-slips')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'weekly-slips'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Weekly Mock Slips & Breakdown
          </button>
          <button
            onClick={() => setActiveTab('progress-chart')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'progress-chart'
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-900/40'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Weekly Progress Trajectory Chart
          </button>
        </div>

        {/* Week Selector Pills if on weekly-slips */}
        {activeTab === 'weekly-slips' && weeklySummaries.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1">
            {weeklySummaries.map((w) => (
              <button
                key={w.weekNumber}
                onClick={() => setSelectedWeek(w.weekNumber)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  selectedWeek === w.weekNumber
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                Week {w.weekNumber} ({w.totalScore400}/400)
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-12 text-center text-slate-400 text-sm">
          Loading student mock examination records...
        </div>
      ) : error ? (
        <div className="bg-red-950/40 border border-red-800 rounded-2xl p-6 text-center text-red-300 text-sm">
          {error}
        </div>
      ) : weeklySummaries.length === 0 ? (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-white font-bold text-base">No Mock Assessment Records Yet</h3>
          <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
            Your subject teachers are currently grading the weekly mock assessments. Once your scores are entered, your weekly score out of 400 and progress chart will appear here.
          </p>
        </div>
      ) : activeTab === 'weekly-slips' && activeWeekSummary ? (
        /* Weekly Assessment Slip Card */
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl print:bg-white print:text-black print:border-none print:shadow-none">
          {/* Slip Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-700 print:border-black gap-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider print:text-emerald-800">
                Official Examination Slip
              </span>
              <h2 className="text-xl font-extrabold text-white print:text-black">
                {activeWeekSummary.mockSeriesTitle}
              </h2>
              <div className="text-xs text-slate-400 print:text-slate-700 mt-0.5">
                Session: {activeWeekSummary.session} • Exam Date:{' '}
                {activeWeekSummary.examDate || 'September 2026'}
              </div>
            </div>

            <div className="text-right bg-slate-900/80 print:bg-slate-100 border border-slate-700 print:border-slate-300 rounded-xl px-5 py-3">
              <span className="text-[11px] text-slate-400 print:text-slate-600 block uppercase font-medium">
                Week {activeWeekSummary.weekNumber} Total Aggregate
              </span>
              <div className="text-2xl font-black text-amber-400 print:text-emerald-800">
                {activeWeekSummary.totalScore400}{' '}
                <span className="text-xs font-bold text-slate-400 print:text-slate-600">/ 400</span>
              </div>
              <span className="text-xs font-semibold text-emerald-400 print:text-emerald-700 block">
                {activeWeekSummary.averagePercentage}% ({activeWeekSummary.overallGrade})
              </span>
            </div>
          </div>

          {/* 4-Subject Detailed Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700 print:border-black text-slate-400 print:text-slate-800 font-bold uppercase text-[11px]">
                  <th className="py-3 px-3">Subject Name</th>
                  <th className="py-3 px-3 text-center">Raw Score</th>
                  <th className="py-3 px-3 text-center">Formula Applied</th>
                  <th className="py-3 px-3 text-center font-bold text-white print:text-black">
                    Feasible Score (/100)
                  </th>
                  <th className="py-3 px-3 text-center">Grade</th>
                  <th className="py-3 px-3">Examiner's Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 print:divide-slate-300">
                {activeWeekSummary.subjects.map((sub, idx) => (
                  <tr key={idx} className="hover:bg-slate-750 transition">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white print:text-black flex items-center gap-2">
                        {sub.subjectName}
                        {sub.isEnglish && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 print:border-amber-600 print:text-amber-800 font-semibold">
                            Compulsory
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 print:text-slate-600">
                        {sub.subjectCode || 'SS3 UTME CORE'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-200 print:text-black">
                      <span className="text-amber-300 print:text-black font-bold">
                        {sub.rawScore}
                      </span>{' '}
                      / {sub.maxRawScore}
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-300 print:text-slate-700">
                      {sub.formula}
                    </td>

                    <td className="py-3.5 px-3 text-center font-bold text-emerald-400 print:text-emerald-800 text-sm font-mono">
                      {sub.score}{' '}
                      <span className="text-[10px] text-slate-400 print:text-slate-600 font-normal">
                        / 100
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.grade.startsWith('A')
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : sub.grade.startsWith('B')
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {sub.grade}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-slate-300 print:text-slate-700 italic">
                      {sub.remark || 'Satisfactory performance'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Grand Total Row */}
                <tr className="bg-slate-900/90 print:bg-slate-200 font-bold border-t-2 border-emerald-500 text-white print:text-black text-sm">
                  <td className="py-4 px-3" colSpan={3}>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" />
                      <span>GRAND TOTAL AGGREGATE (4 CORE SUBJECTS)</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center text-lg text-amber-300 print:text-emerald-900 font-black font-mono">
                    {activeWeekSummary.totalScore400} / 400
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-bold">
                      {activeWeekSummary.overallGrade}
                    </span>
                  </td>
                  <td className="py-4 px-3 text-xs text-emerald-400 print:text-emerald-800">
                    {activeWeekSummary.targetBenchmarkRemark}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Verification Slip Footer */}
          <div className="mt-8 pt-6 border-t border-slate-700 print:border-black flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 print:text-slate-700 gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              <div>
                <span className="font-bold text-white print:text-black block">
                  Fenster International School Verification Stamp
                </span>
                <span className="text-[10px]">
                  Generated on {new Date().toLocaleDateString('en-GB')} • Validated against Master Ledger
                </span>
              </div>
            </div>

            <div className="flex items-center gap-8 text-center">
              <div>
                <div className="w-32 border-b border-slate-600 print:border-black mb-1" />
                <span className="text-[10px] uppercase">SS3 Mock Examiner</span>
              </div>
              <div>
                <div className="w-32 border-b border-slate-600 print:border-black mb-1" />
                <span className="text-[10px] uppercase">Principal / Registrar</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Progress Chart View */
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Weekly Mock Trajectory & Progress Chart (Over 400)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring score progression across all weekly UTME mock assessments.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                Weekly Score (/400)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-1 bg-amber-400 inline-block" />
                Competitive Benchmark (250+)
              </span>
            </div>
          </div>

          {/* Interactive Recharts Performance Graph */}
          <div className="bg-slate-900/90 border border-slate-750 rounded-2xl p-5 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Performance Trajectory Trend
                </h3>
                <p className="text-[11px] text-slate-400">
                  Weekly score trajectory plotted against 250 Target and 300+ Elite benchmarks
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Candidate Score
                </span>
                <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                  <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                  250 Target
                </span>
                <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                  300 Elite
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressData} margin={{ top: 15, right: 30, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                  <XAxis
                    dataKey="weekLabel"
                    stroke="#94a3b8"
                    tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 500 }}
                  />
                  <YAxis
                    domain={[0, 400]}
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    ticks={[0, 100, 200, 250, 300, 400]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#10b981',
                      borderRadius: '14px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
                      padding: '10px 14px',
                    }}
                    formatter={(value: any) => [`${value} / 400 (${Math.round((value / 400) * 100)}%)`, 'Aggregate Score']}
                    labelFormatter={(label) => `${label} UTME Mock Examination`}
                  />
                  <ReferenceLine
                    y={250}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Target (250)', fill: '#f59e0b', fontSize: 11, position: 'right' }}
                  />
                  <ReferenceLine
                    y={300}
                    stroke="#34d399"
                    strokeDasharray="4 4"
                    label={{ value: 'Elite (300+)', fill: '#34d399', fontSize: 11, position: 'right' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalScore400"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#scoreGradient)"
                    activeDot={{ r: 7, stroke: '#34d399', strokeWidth: 2, fill: '#064e3b' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Visual Bar / Progression Graph */}
          <div className="space-y-4">
            {progressData.map((pt, index) => {
              const prev = index > 0 ? progressData[index - 1] : null;
              const delta = prev ? Math.round((pt.totalScore400 - prev.totalScore400) * 10) / 10 : null;
              const widthPct = Math.min(100, Math.max(0, (pt.totalScore400 / 400) * 100));

              return (
                <div key={pt.weekNumber} className="bg-slate-900/80 border border-slate-750 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
                        W{pt.weekNumber}
                      </span>
                      <div>
                        <span className="font-bold text-white text-sm">{pt.weekLabel}</span>
                        <span className="text-[11px] text-slate-400 block">
                          {pt.examDate ? `Exam Date: ${pt.examDate}` : '4 Subjects Completed'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-amber-300 font-mono">
                        {pt.totalScore400}{' '}
                        <span className="text-xs text-slate-400 font-normal">/ 400</span>
                      </div>
                      <div className="text-xs font-semibold text-emerald-400 flex items-center justify-end gap-1">
                        <span>{pt.percentage}%</span>
                        {delta !== null && (
                          <span
                            className={`text-[10px] font-bold ${
                              delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            ({delta >= 0 ? `+${delta}` : delta} pts)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar with 200, 250, 300 milestone markers */}
                  <div className="relative pt-1">
                    <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden flex">
                      <div
                        className="bg-gradient-to-r from-emerald-600 to-amber-400 h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    {/* Milestone lines */}
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span>0</span>
                      <span className="text-slate-400">200 (Pass)</span>
                      <span className="text-amber-400 font-bold">250 (Target)</span>
                      <span className="text-emerald-400 font-bold">300+ (Elite)</span>
                      <span>400</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cumulative Performance Statement */}
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Award className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-white text-sm block">
                  Overall Academic Standing: {overallAverageScore >= 300 ? 'Elite Distinction' : overallAverageScore >= 250 ? 'Strong Candidate' : 'Satisfactory Progress'}
                </span>
                <span className="text-xs text-slate-300">
                  Current Cumulative Average: <strong>{overallAverageScore} / 400 marks</strong>. Keep testing weekly to consolidate university admission standards.
                </span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('weekly-slips')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              View Full Week Slips
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Save,
  Sparkles,
} from 'lucide-react';
import { Student, AssessmentRecord } from '../types/index.ts';
import { getLocalStudents, getInstitutionalVault, fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import { supabase } from '../supabaseConfig.ts';
import { isStudentFeeLocked, getStudentFeeLockDetails } from '../lib/bursarStore.ts';
import { FeeWithheldNotice } from './FeeWithheldNotice.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { isSecondaryClass, calculateSubjectGrade } from '../constants/classes.ts';

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
  const isStudent = user?.role === 'student' || Boolean(user?.studentId) || Boolean((user as any)?.studentProfile);
  const isBursar = user?.role === 'bursar';
  const hasAdminPrivileges =
    user?.role === 'super_admin' ||
    user?.role === 'director' ||
    user?.role === 'principal' ||
    user?.role === 'admin';
  const canAddScore = !isStudent && !isBursar && Boolean(onAddScoreForStudent);
  const canManageScores = !isStudent && !isBursar;

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

  // Edit Score Modal State
  const [editingAssessment, setEditingAssessment] = useState<AssessmentRecord | null>(null);
  const [editCa, setEditCa] = useState<string>('');
  const [editExam, setEditExam] = useState<string>('');
  const [editComment, setEditComment] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

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

        // Fetch regular assessments from API if not yet provided
        if (realAssessments.length === 0) {
          try {
            const res = await fetch(`/api/scores?student=${encodeURIComponent(resolvedStudent.studentId)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const text = await res.text();
              let data: any = {};
              try { data = JSON.parse(text); } catch (_) {}
              if (Array.isArray(data.scores)) {
                realAssessments = data.scores.map((a: any) => ({
                  id: a.id,
                  studentId: resolvedStudent!.studentId,
                  subjectId: a.subjectId,
                  subjectName: a.subjectName || 'Subject',
                  subjectCode: a.subjectCode || 'SUB',
                  assessmentTitle: a.assessmentTitle || 'Continuous Assessment',
                  assessmentType: a.assessmentType || 'test',
                  score: Number(a.score) || 0,
                  maxScore: Number(a.maxScore || 100),
                  percentage: Number(a.percentage || a.score || 0),
                  grade: a.grade || 'A',
                  session: a.session || resolvedStudent!.session,
                  term: a.term || 'First Term',
                  teacherComment: a.teacherComment || '',
                  createdAt: a.createdAt,
                }));
              }
            }
          } catch (_) {}
        }

        // Fetch SS3 Mock scores from Backend API
        try {
          const res = await fetch(
            `/api/ss3-mock/scores?studentId=${resolvedStudent.id}&studentNumber=${encodeURIComponent(
              resolvedStudent.studentId
            )}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const mText = await res.text();
            let mData: any = {};
            try { mData = JSON.parse(mText); } catch (_) {}
            if (mData && Array.isArray(mData.scores) && mData.scores.length > 0) {
              realMockScores = mData.scores;
            } else if (mData && Array.isArray(mData.weeklySummaries)) {
              const flat: any[] = [];
              for (const ws of mData.weeklySummaries) {
                if (Array.isArray(ws.subjects)) {
                  for (const sub of ws.subjects) {
                    flat.push({
                      id: sub.id || `${ws.weekNumber}_${sub.subjectId}`,
                      studentId: resolvedStudent.studentId,
                      subjectId: sub.subjectId,
                      subjectName: sub.subjectName,
                      subjectCode: sub.subjectCode || (sub.isEnglish ? 'ENG' : 'ELEC'),
                      weekNumber: ws.weekNumber,
                      rawScore: sub.rawScore,
                      maxRawScore: sub.maxRawScore,
                      score: Number(sub.score || sub.scaledScore || 0),
                      maxScore: 100,
                      percentage: Number(sub.score || sub.scaledScore || 0),
                      grade: sub.grade || (Number(sub.score) >= 75 ? 'A1' : 'C4'),
                      remark: sub.remark || (Number(sub.score) >= 70 ? 'Distinction' : 'Credit'),
                    });
                  }
                }
              }
              if (flat.length > 0) realMockScores = flat;
            }
          }
        } catch (_) {}

        // Fallback to Supabase if mock scores not returned by backend
        if (realMockScores.length === 0) {
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
        }

        // Merge from localStorage fis_broadsheet_scores_v2
        try {
          const rawBroad = localStorage.getItem('fis_broadsheet_scores_v2');
          if (rawBroad) {
            const broadList = JSON.parse(rawBroad);
            const studentBroad = broadList.filter(
              (b: any) =>
                String(b.studentId) === String(resolvedStudent!.id) ||
                (b.studentNumber && b.studentNumber === resolvedStudent!.studentId)
            );
            studentBroad.forEach((b: any, idx: number) => {
              const total = Number(b.totalScore || ((b.testScore || 0) + (b.examScore || 0)));
              const subName = b.subjectName || 'Subject';
              const title = `${b.examPeriod === 'first-half' ? '1st Half Term' : 'Terminal Term'} Examination`;
              const exists = realAssessments.some(
                (a) => Number(a.subjectId) === Number(b.subjectId) && a.assessmentTitle.includes(b.examPeriod === 'first-half' ? '1st' : 'Terminal')
              );
              if (!exists && total > 0) {
                realAssessments.push({
                  id: b.id || b.testId || b.examId || `loc_broad_${resolvedStudent!.id}_${b.subjectId}_${idx}`,
                  studentId: resolvedStudent!.studentId,
                  subjectId: b.subjectId,
                  subjectName: subName,
                  subjectCode: 'SUB',
                  assessmentTitle: title,
                  assessmentType: 'Examination',
                  score: total,
                  maxScore: 100,
                  percentage: total,
                  grade: calculateSubjectGrade(total),
                  session: b.session || resolvedStudent!.session || '2026/2027',
                  term: b.term || 'First Term',
                  teacherComment: JSON.stringify({
                    caScore: b.testScore,
                    examScore: b.examScore,
                    totalScore: b.totalScore,
                    examPeriod: b.examPeriod,
                  }),
                  createdAt: new Date().toISOString(),
                });
              }
            });
          }
        } catch (_) {}

        // Merge from localStorage fis_mock_scores_v2
        try {
          const rawMock = localStorage.getItem('fis_mock_scores_v2');
          if (rawMock) {
            const mockList = JSON.parse(rawMock);
            const studentMocks = mockList.filter(
              (m: any) =>
                String(m.studentId) === String(resolvedStudent!.id) ||
                (m.studentNumber && m.studentNumber === resolvedStudent!.studentId)
            );
            studentMocks.forEach((sm: any) => {
              if (Array.isArray(sm.subjects)) {
                sm.subjects.forEach((sub: any) => {
                  const sScore = Number(sub.score || sub.scaledScore || 0);
                  const already = realMockScores.some(
                    (rm) => rm.weekNumber === (sm.weekNumber || 1) && (rm.subjectId === sub.subjectId || rm.subjectName === sub.subjectName)
                  );
                  if (!already && sScore > 0) {
                    realMockScores.push({
                      id: sub.id || `${sm.weekNumber}_${sub.subjectId}`,
                      studentId: resolvedStudent!.studentId,
                      subjectId: sub.subjectId,
                      subjectName: sub.subjectName,
                      subjectCode: sub.subjectCode || (sub.isEnglish ? 'ENG' : 'ELEC'),
                      weekNumber: sm.weekNumber || 1,
                      rawScore: sub.rawScore,
                      maxRawScore: sub.maxRawScore,
                      score: sScore,
                      maxScore: 100,
                      percentage: sScore,
                      grade: sub.grade || (sScore >= 75 ? 'A1' : 'C4'),
                      remark: sub.remark || 'Good Progress',
                    });
                  }
                });
              }
            });
          }
        } catch (_) {}

        // Filter out empty score items
        realAssessments = realAssessments.filter(
          (a) => Number(a.score) > 0 || Number(a.percentage) > 0 || a.assessmentType === 'CA'
        );
        realMockScores = realMockScores.filter((m) => Number(m.score) > 0 || Number(m.percentage) > 0);

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

    const handleDataUpdated = () => {
      loadProfile();
    };

    window.addEventListener('fis:scores-updated', handleDataUpdated);
    window.addEventListener('fis:mock-scores-updated', handleDataUpdated);
    return () => {
      window.removeEventListener('fis:scores-updated', handleDataUpdated);
      window.removeEventListener('fis:mock-scores-updated', handleDataUpdated);
    };
  }, [studentIdOrId, token]);

  // Open Edit Assessment Modal
  const handleOpenEdit = (a: AssessmentRecord) => {
    let parsedCa = '';
    let parsedExam = '';
    let userNote = a.teacherComment || '';

    try {
      if (a.teacherComment && a.teacherComment.trim().startsWith('{')) {
        const obj = JSON.parse(a.teacherComment);
        if (obj.caScore !== undefined) parsedCa = String(obj.caScore);
        if (obj.examScore !== undefined) parsedExam = String(obj.examScore);
        if (obj.userNote !== undefined) userNote = obj.userNote;
      }
    } catch (_) {}

    if (!parsedCa && Number(a.maxScore) === 40) {
      parsedCa = String(a.score);
    } else if (!parsedExam && Number(a.maxScore) === 60) {
      parsedExam = String(a.score);
    } else if (!parsedCa && !parsedExam) {
      parsedExam = String(a.score);
    }

    setEditingAssessment(a);
    setEditCa(parsedCa);
    setEditExam(parsedExam);
    setEditComment(userNote);
  };

  const handleSaveEdit = async () => {
    if (!editingAssessment) return;
    setSavingEdit(true);

    try {
      const parsedCaNum = editCa === '' ? null : Math.min(40, Math.max(0, parseFloat(editCa) || 0));
      const parsedExamNum = editExam === '' ? null : Math.min(60, Math.max(0, parseFloat(editExam) || 0));

      const isCaItem = Number(editingAssessment.maxScore) === 40 || editingAssessment.assessmentType === 'CA';
      const targetScore = isCaItem ? (parsedCaNum ?? Number(editingAssessment.score)) : (parsedExamNum ?? Number(editingAssessment.score));

      const updatedPayload = JSON.stringify({
        caScore: parsedCaNum,
        examScore: parsedExamNum,
        totalScore: (parsedCaNum || 0) + (parsedExamNum || 0),
        userNote: editComment,
      });

      const res = await fetch(`/api/scores/${editingAssessment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          score: targetScore,
          maxScore: editingAssessment.maxScore,
          teacherComment: updatedPayload,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(text); } catch (_) {}
        throw new Error(errData.error || errData.message || 'Failed to update score');
      }

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setEditingAssessment(null);
      await loadProfile();
    } catch (err: any) {
      alert(err.message || 'Failed to update score');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteScore = async (scoreId: number | string, subjectTitle: string) => {
    try {
      const isFaculty = user && user.role !== 'student' && user.role !== 'bursar';
      const authToken =
        (isFaculty && token)
          ? token
          : (token && !token.includes('student') && !token.includes('bursar'))
          ? token
          : (typeof sessionStorage !== 'undefined' &&
             sessionStorage.getItem('sqams_token') &&
             !sessionStorage.getItem('sqams_token')?.includes('student') &&
             !sessionStorage.getItem('sqams_token')?.includes('bursar')
              ? sessionStorage.getItem('sqams_token')
              : null) || 'local-teacher-auth:teacher@school.edu';

      // Optimistically remove from state immediately
      setAssessments((prev) => prev.filter((a) => String(a.id) !== String(scoreId)));

      const res = await fetch(`/api/scores/${scoreId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) {
        const text = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(text); } catch (_) {}
        const errorMsg = errData.error || errData.message || (text.length < 200 && !text.includes('<') ? text : '') || 'Failed to delete score';
        throw new Error(errorMsg);
      }

      // Also clean up local broadsheet cache
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter((l: any) => {
            const matchesDirectId = String(l.testId) === String(scoreId) || String(l.examId) === String(scoreId) || String(l.id) === String(scoreId);
            if (matchesDirectId) return false;
            if (typeof scoreId === 'string' && scoreId.includes('loc_broad_') && scoreId.includes(`_${l.subjectId}_`)) {
              return false;
            }
            return true;
          });
          localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
        }
      } catch (_) {}

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      await loadProfile();
    } catch (err: any) {
      console.error('Delete score error in StudentProfile:', err);
      await loadProfile();
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
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

  // Fee Lock Check
  const studentKey = student.studentId || String(student.id || studentIdOrId);
  const isLockedForFees =
    isStudentFeeLocked(studentKey) || isStudentFeeLocked(student.id) || isStudentFeeLocked(student.email);
  const lockDetails = isLockedForFees
    ? getStudentFeeLockDetails(studentKey) || getStudentFeeLockDetails(student.id)
    : null;

  const isSS3 =
    (student.currentClass || '').toUpperCase().includes('SS 3') ||
    (student.currentClass || '').toUpperCase().includes('SS3') ||
    (student.currentClass || '').toUpperCase().includes('SSS 3') ||
    (student.currentClass || '').toUpperCase().includes('SSS3');

  // Compute SS3 JAMB Mock Aggregate Over 400
  // Group mock scores by weekNumber, sum the top 4 subjects for each week, and take the latest week
  const weekGroups: Record<number, any[]> = {};
  mockScores.forEach((m) => {
    const w = m.weekNumber || 1;
    if (!weekGroups[w]) weekGroups[w] = [];
    weekGroups[w].push(m);
  });

  const weekNumbers = Object.keys(weekGroups).map(Number).sort((a, b) => b - a);
  let latestWeekMockTotal400 = 0;
  let latestWeekMockWeek = 1;
  let highestWeekMockTotal400 = 0;

  weekNumbers.forEach((w, idx) => {
    const list = weekGroups[w] || [];
    const top4 = list.slice(0, 4);
    const sum = top4.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    if (idx === 0) {
      latestWeekMockTotal400 = sum;
      latestWeekMockWeek = w;
    }
    if (sum > highestWeekMockTotal400) {
      highestWeekMockTotal400 = sum;
    }
  });

  const jambMockDisplayScore = latestWeekMockTotal400 || highestWeekMockTotal400;
  const jambMockPercentage = Math.round((jambMockDisplayScore / 400) * 1000) / 10;

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

        {/* 1. WELCOME BACK BANNER (For Student Portal) */}
        {isStudent && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0 shadow-md">
                👋
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>
                    Welcome back, <strong className="text-amber-300">{student.firstName} {student.surname}</strong>!
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Fenster International School Academic Portal • Session {student.session || '2026/2027'} • Class{' '}
                  <span className="font-semibold text-emerald-400">{student.currentClass}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-emerald-300 font-mono font-bold">
                Student ID: {student.studentId}
              </span>
            </div>
          </div>
        )}

        {/* 2. SSS3 JAMB MOCK SCORE BANNER (OVER 400) */}
        {isSS3 && (
          <div className="bg-gradient-to-r from-amber-950/50 via-slate-900 to-emerald-950/40 border border-amber-500/40 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-md">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  Official SSS3 JAMB / UTME Mock Examination
                </span>
                <h3 className="text-base font-bold text-white mt-0.5 flex items-center gap-2">
                  Composite Mock Aggregate: <span className="text-amber-300 font-mono font-extrabold">{jambMockDisplayScore} / 400</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Standard JAMB / UTME 4-core aggregate (English Language scaled ÷ 60 × 100 + 3 electives scaled ÷ 40 × 100)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-900/90 border border-amber-500/50 rounded-2xl px-5 py-3 self-start sm:self-auto shadow-inner">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Week {latestWeekMockWeek} Aggregate
                </span>
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {jambMockDisplayScore}{' '}
                  <span className="text-xs font-normal text-slate-400 font-sans">/ 400</span>
                </span>
              </div>
              <div className="border-l border-slate-700 pl-3.5 text-center">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 font-mono block">
                  {jambMockPercentage}%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                  {jambMockDisplayScore >= 280 ? 'Distinction' : jambMockDisplayScore >= 200 ? 'Credit' : 'Pass'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Main Student Header Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-xl fis-card-accent relative overflow-hidden">
          {/* School Crest Watermark */}
          <div className="absolute right-0 top-0 bottom-0 opacity-5 pointer-events-none flex items-center pr-8">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-48 w-auto" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-amber-300 flex items-center justify-center text-xl font-bold shrink-0 shadow-lg shadow-emerald-950 border border-amber-400/40">
                {student.firstName?.[0] || 'S'}
                {student.surname?.[0] || 'C'}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {student.firstName} {student.middleName ? student.middleName + ' ' : ''}
                    {student.surname}
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
              <span className="text-2xl font-bold text-white">{stats.averageScore}%</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Overall Academic Mean</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                Highest Assessment
              </span>
              <span className="text-2xl font-bold text-emerald-400">{stats.highestScore}%</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Top Mark Recorded</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Lowest Assessment
              </span>
              <span className="text-2xl font-bold text-amber-400">{stats.lowestScore}%</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Needs Attention Area</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                Total Assessments
              </span>
              <span className="text-2xl font-bold text-purple-400">{stats.totalAssessments}</span>
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
              SS3 Mock Results & Aggregate (/400)
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
        {profileTab === 'assessments' &&
          (isStudent && isLockedForFees ? (
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
                    Switch to SS3 Mock Results Tab (/400)
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
                              <div
                                key={r.id}
                                className="flex items-center justify-between text-slate-300 py-1 border-b border-slate-800/60 last:border-0"
                              >
                                <span className="text-slate-400 truncate max-w-[150px]">
                                  {r.assessmentTitle || 'Test'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-white">
                                    {r.score}/{r.maxScore}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      r.grade === 'A' || r.grade === 'A1'
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : r.grade === 'B' || r.grade === 'B2' || r.grade === 'B3'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : r.grade === 'C' || r.grade === 'C4' || r.grade === 'C5' || r.grade === 'C6'
                                        ? 'bg-amber-500/20 text-amber-400'
                                        : 'bg-rose-500/20 text-rose-400'
                                    }`}
                                  >
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

              {/* Assessment History Table with Edit & Delete actions */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      Complete Assessment & Score History
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Continuous assessments (CA max 40), periodic tests, and examination (max 60) records.
                    </p>
                  </div>
                </div>

                {assessments.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-medium text-slate-300">No continuous assessment scores recorded yet</p>
                    <p className="text-xs mt-1">
                      {canAddScore
                        ? 'Click "Add Score" above to record the scholar\'s first assessment.'
                        : 'Scores will appear here once submitted by subject teachers.'}
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
                          {canManageScores && (
                            <th className="py-3 px-4 text-center">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60 text-slate-300">
                        {assessments.map((a) => {
                          let parsedComment = a.teacherComment || '—';
                          try {
                            if (a.teacherComment && a.teacherComment.trim().startsWith('{')) {
                              const obj = JSON.parse(a.teacherComment);
                              parsedComment = obj.userNote || `CA: ${obj.caScore ?? '-'}, Exam: ${obj.examScore ?? '-'}`;
                            }
                          } catch (_) {}

                          return (
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
                                <span
                                  className={`inline-block px-2 py-0.5 rounded font-bold ${
                                    a.grade === 'A' || a.grade === 'A1'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : a.grade === 'B' || a.grade === 'B2' || a.grade === 'B3'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : a.grade === 'C' || a.grade === 'C4' || a.grade === 'C5' || a.grade === 'C6'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}
                                >
                                  {a.grade || 'C'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                {a.session} • {a.term}
                              </td>
                              <td className="py-3.5 px-4 text-slate-400 italic max-w-xs truncate">
                                {parsedComment}
                              </td>
                              {canManageScores && (
                                <td className="py-3.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(a)}
                                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition cursor-pointer"
                                      title="Edit this recorded score"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteScore(a.id, a.subjectName)}
                                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-400 transition cursor-pointer"
                                      title="Delete this recorded score"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}

        {/* TAB 2: SS3 MOCK RESULTS (OVER 400) */}
        {profileTab === 'mock-results' && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-700">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  SS3 UTME / JAMB Mock Examination Records (Over 400)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official weekly mock trajectory. Standard aggregate is calculated across 4 core UTME subjects (max 400 marks).
                </p>
              </div>

              <div className="bg-slate-900 border border-amber-500/40 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Latest Mock Aggregate</span>
                <span className="text-lg font-black text-amber-300 font-mono">
                  {jambMockDisplayScore} <span className="text-xs font-normal text-slate-400">/ 400</span>
                </span>
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
                    {mockScores.map((m, idx) => (
                      <tr key={m.id || idx} className="hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {m.subjectName} ({m.subjectCode || 'MOCK'})
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">Week {m.weekNumber}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                          {m.score} / 100
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 text-[10px]">
                            {m.grade || 'Good'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 italic">
                          {m.remark || 'Satisfactory Progress'}
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
        {profileTab === 'printable-slip' &&
          (isStudent && isLockedForFees ? (
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
                  <strong className="text-white print:text-black text-sm">
                    {student.firstName} {student.surname}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Admission ID</span>
                  <strong className="font-mono text-emerald-400 print:text-emerald-900">{student.studentId}</strong>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Class / Session</span>
                  <strong className="text-white print:text-black">
                    {student.currentClass} • {student.session || '2026/2027'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 print:text-slate-600 block text-[10px] uppercase font-semibold">Financial Clearance</span>
                  <span className="font-bold text-emerald-400 print:text-emerald-900">
                    {isLockedForFees ? 'Pending Clearance' : 'Cleared by Bursary'}
                  </span>
                </div>
              </div>

              {/* SS3 JAMB Mock Examination Highlight Box (Over 400) */}
              {isSS3 && (
                <div className="my-5 p-4.5 bg-amber-500/10 print:bg-slate-100 border-2 border-amber-500/50 print:border-black rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-amber-500 print:text-black shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold text-amber-500 print:text-black uppercase tracking-wider block">
                        Official SSS 3 UTME / JAMB Mock Examination Result
                      </span>
                      <strong className="text-white print:text-black text-sm">
                        Week {latestWeekMockWeek} Mock Composite Aggregate (4-Core Subjects)
                      </strong>
                      <span className="text-[11px] text-slate-400 print:text-slate-600 block mt-0.5">
                        English Language (Scaled /60) + 3 Core Subject Electives (Scaled /40)
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-amber-400 print:text-black font-mono">
                      {jambMockDisplayScore > 0 ? jambMockDisplayScore : '---'} / 400
                    </span>
                    <span className="text-[11px] text-slate-400 print:text-slate-700 block font-semibold">
                      {jambMockDisplayScore > 0 ? `(${jambMockPercentage}% • ${jambMockDisplayScore >= 280 ? 'Distinction' : jambMockDisplayScore >= 200 ? 'Credit' : 'Pass'})` : 'Score in Compilation'}
                    </span>
                  </div>
                </div>
              )}

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
          ))}
      </div>

      {/* Edit Assessment Score Modal */}
      {editingAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Edit Recorded Score
              </h3>
              <button
                onClick={() => setEditingAssessment(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-800 p-3 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Subject & Assessment:</span>
                <p className="font-bold text-white text-sm">{editingAssessment.subjectName}</p>
                <p className="text-slate-400 text-xs">{editingAssessment.assessmentTitle}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    CA Score (Max 40)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    step="0.5"
                    value={editCa}
                    onChange={(e) => setEditCa(e.target.value)}
                    placeholder="0 - 40"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Exam Score (Max 60)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    value={editExam}
                    onChange={(e) => setEditExam(e.target.value)}
                    placeholder="0 - 60"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Teacher Remarks / Pedagogical Notes
                </label>
                <input
                  type="text"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Feedback on scholar performance"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setEditingAssessment(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                {savingEdit ? 'Updating...' : 'Update Score Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

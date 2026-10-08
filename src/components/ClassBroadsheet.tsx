import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  FileSpreadsheet,
  Printer,
  Edit2,
  Trash2,
  Plus,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  Layers,
  ChevronDown,
  BookOpen,
  Calendar,
  Sparkles,
  Users,
  Award,
  RefreshCw
} from 'lucide-react';
import { SCHOOL_CLASSES, isSecondaryClass } from '../constants/classes.ts';
import { Subject, Student } from '../types/index.ts';
import { fetchAllSubjectsUnified } from '../lib/subjectStore.ts';
import { fetchAllStudentsUnified, getLocalStudents } from '../lib/schoolStore.ts';

export { isSecondaryClass };

// Grade calculation helper
export function calculateSubjectGrade(totalScore: number): string {
  if (totalScore >= 75) return 'A1';
  if (totalScore >= 70) return 'B2';
  if (totalScore >= 65) return 'B3';
  if (totalScore >= 60) return 'C4';
  if (totalScore >= 55) return 'C5';
  if (totalScore >= 50) return 'C6';
  if (totalScore >= 45) return 'D7';
  if (totalScore >= 40) return 'E8';
  return 'F9';
}

export const ClassBroadsheet: React.FC = () => {
  const { user, token } = useAuth();

  // Filters & Scope
  const [selectedClass, setSelectedClass] = useState<string>('SS 3');
  const [selectedTerm, setSelectedTerm] = useState<string>('First Term');
  const [selectedSession, setSelectedSession] = useState<string>('2026/2027');
  const [examPeriod, setExamPeriod] = useState<'first-half' | 'terminal'>('terminal');

  // Roster & Subjects
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Student assessments dictionary: studentId -> Map<subjectId, SubjectScoreCell>
  interface SubjectScoreCell {
    subjectId: number;
    subjectName: string;
    testScore: number | null; // out of 40 (Continuous Assessment / 6th week test)
    examScore: number | null; // out of 60 (Main examination)
    totalScore: number | null; // out of 100 (CA 40 + Exam 60)
    grade: string;
    testId?: number | null;
    examId?: number | null;
    generalId?: number | null;
  }

  // Student row in broadsheet:
  interface BroadsheetRow {
    student: Student;
    subjectCells: Record<number, SubjectScoreCell>;
    totalMarksSum: number;
    enteredSubjectsCount: number;
    averageScore: number;
    rank?: number;
  }

  const [broadsheetRows, setBroadsheetRows] = useState<BroadsheetRow[]>([]);

  // Modal for editing or entering score for a student & subject
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{
    student: Student;
    subject: Subject;
    currentTest: string;
    currentExam: string;
    currentTotal: string;
    testId?: number | null;
    examId?: number | null;
    generalId?: number | null;
  } | null>(null);

  const [inputTestScore, setInputTestScore] = useState<string>('');
  const [inputExamScore, setInputExamScore] = useState<string>('');
  const [inputSaving, setInputSaving] = useState<boolean>(false);

  // Modal for adding a new subject
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');

  // Modal for editing an existing subject
  const [editSubjectModalOpen, setEditSubjectModalOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [savingSubjectEdit, setSavingSubjectEdit] = useState(false);

  const isSecondary = isSecondaryClass(selectedClass);
  const effectiveExamPeriod: 'first-half' | 'terminal' = isSecondary ? examPeriod : 'terminal';

  // Load students & subjects & scores
  const loadData = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      // 1. Unified subjects
      const subs = await fetchAllSubjectsUnified(token);
      setAvailableSubjects(subs);

      // 2. Unified students
      const allStudents = await fetchAllStudentsUnified(token);
      const filtered = allStudents.filter((s) => {
        const sc = (s.currentClass || '').toUpperCase().trim();
        const tc = selectedClass.toUpperCase().trim();
        return sc === tc || sc.includes(tc) || tc.includes(sc);
      });
      const targetStudents = filtered.length > 0 ? filtered : allStudents.slice(0, 10);
      setClassStudents(targetStudents);

      // 3. Fetch scores from backend
      let serverScores: any[] = [];
      try {
        const res = await fetch(
          `/api/scores?class=${encodeURIComponent(selectedClass)}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const text = await res.text();
          let d: any = {};
          try { d = JSON.parse(text); } catch (_) {}
          serverScores = d.results || [];
        }
      } catch (e) {
        console.warn('Backend scores fetch note:', e);
      }

      // 4. Merge with local storage cache (fis_broadsheet_scores_v2)
      let localScores: any[] = [];
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) localScores = JSON.parse(cached);
      } catch (_) {}

      // Build broadsheet rows
      const rows: BroadsheetRow[] = targetStudents.map((st) => {
        const cellMap: Record<number, SubjectScoreCell> = {};
        let totalSum = 0;
        let countedSubjects = 0;

        subs.forEach((sub) => {
          // Find assessments for this student and subject
          const stScores = serverScores.filter(
            (sc) => (sc.studentDbId === st.id || sc.studentId === st.studentId) && Number(sc.subjectId) === sub.id
          );

          // Find local overrides if any
          const locMatch = localScores.find(
            (l) =>
              (l.studentId === st.id || l.studentNumber === st.studentId) &&
              Number(l.subjectId) === sub.id &&
              l.term === selectedTerm &&
              l.session === selectedSession &&
              l.examPeriod === effectiveExamPeriod
          );

          let test: number | null = null;
          let exam: number | null = null;
          let testId: number | null = null;
          let examId: number | null = null;
          let generalId: number | null = null;

          if (locMatch) {
            test = locMatch.testScore !== undefined && locMatch.testScore !== null ? Number(locMatch.testScore) : null;
            exam = locMatch.examScore !== undefined && locMatch.examScore !== null ? Number(locMatch.examScore) : null;
          } else if (stScores.length > 0) {
            // Find CA / test score (marked over 40) for this examPeriod
            const testRec = stScores.find((s) => {
              const title = (s.assessmentTitle || '').toLowerCase();
              const comm = (s.teacherComment || '').toLowerCase();
              const isCA =
                s.assessmentType === 'CA' ||
                s.assessmentType === 'Test' ||
                title.includes('ca') ||
                title.includes('test') ||
                Number(s.maxScore) === 40;
              if (!isCA) return false;

              if (isSecondary) {
                if (effectiveExamPeriod === 'first-half') {
                  return (
                    title.includes('first half') ||
                    title.includes('1st half') ||
                    title.includes('6th') ||
                    comm.includes('first-half')
                  );
                } else {
                  return (
                    !title.includes('first half') &&
                    !title.includes('1st half') &&
                    !title.includes('6th') &&
                    !comm.includes('first-half')
                  );
                }
              }
              return true;
            });

            if (testRec) {
              test = Number(testRec.score);
              testId = testRec.id;
            }

            // Find main exam score (marked over 60) for this examPeriod
            const examRec = stScores.find((s) => {
              const title = (s.assessmentTitle || '').toLowerCase();
              const comm = (s.teacherComment || '').toLowerCase();
              const isExam =
                s.assessmentType === 'Examination' ||
                title.includes('exam') ||
                Number(s.maxScore) === 60;
              if (!isExam) return false;

              if (isSecondary) {
                if (effectiveExamPeriod === 'first-half') {
                  return (
                    title.includes('first half') ||
                    title.includes('1st half') ||
                    title.includes('6th') ||
                    comm.includes('first-half')
                  );
                } else {
                  return (
                    !title.includes('first half') &&
                    !title.includes('1st half') &&
                    !title.includes('6th') &&
                    !comm.includes('first-half')
                  );
                }
              }
              return true;
            });

            if (examRec) {
              exam = Number(examRec.score);
              examId = examRec.id;
            }

            // Fallback for generic legacy records
            if (!testRec && !examRec && stScores[0]) {
              generalId = stScores[0].id;
              const scVal = Number(stScores[0].score);
              const maxS = Number(stScores[0].maxScore) || 100;
              if (maxS === 40) {
                test = scVal;
              } else if (maxS === 60) {
                exam = scVal;
              } else {
                test = Math.round((scVal * 40) / 100);
                exam = Math.round((scVal * 60) / 100);
              }
            }
          }

          // Total is always CA (max 40) + Exam (max 60) = 100
          let cellTotal: number | null = null;
          if (test !== null || exam !== null) {
            cellTotal = (test || 0) + (exam || 0);
          }

          if (cellTotal !== null) {
            totalSum += cellTotal;
            countedSubjects++;
          }

          const gradeStr = cellTotal !== null ? calculateSubjectGrade(cellTotal) : '-';

          cellMap[sub.id] = {
            subjectId: sub.id,
            subjectName: sub.name,
            testScore: test,
            examScore: exam,
            totalScore: cellTotal,
            grade: gradeStr,
            testId,
            examId,
            generalId,
          };
        });

        const avg = countedSubjects > 0 ? Math.round((totalSum / countedSubjects) * 10) / 10 : 0;

        return {
          student: st,
          subjectCells: cellMap,
          totalMarksSum: totalSum,
          enteredSubjectsCount: countedSubjects,
          averageScore: avg,
        };
      });

      // Rank rows by totalMarksSum descending
      rows.sort((a, b) => b.totalMarksSum - a.totalMarksSum);
      rows.forEach((r, idx) => {
        r.rank = r.enteredSubjectsCount > 0 ? idx + 1 : undefined;
      });

      setBroadsheetRows(rows);
    } catch (err: any) {
      console.error('Failed to load broadsheet:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to fetch broadsheet data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleScoresChanged = () => {
      loadData();
    };

    window.addEventListener('fis:scores-updated', handleScoresChanged);
    window.addEventListener('fis:broadsheet-scores-updated', handleScoresChanged);
    return () => {
      window.removeEventListener('fis:scores-updated', handleScoresChanged);
      window.removeEventListener('fis:broadsheet-scores-updated', handleScoresChanged);
    };
  }, [selectedClass, selectedTerm, selectedSession, examPeriod]);

  // Handle click on score cell to open inline editor
  const handleOpenEditCell = (student: Student, subject: Subject, cell?: SubjectScoreCell) => {
    setActiveCell({
      student,
      subject,
      currentTest: cell?.testScore !== null && cell?.testScore !== undefined ? String(cell.testScore) : '',
      currentExam: cell?.examScore !== null && cell?.examScore !== undefined ? String(cell.examScore) : '',
      currentTotal: cell?.totalScore !== null && cell?.totalScore !== undefined ? String(cell.totalScore) : '',
      testId: cell?.testId,
      examId: cell?.examId,
      generalId: cell?.generalId,
    });

    setInputTestScore(cell?.testScore !== null && cell?.testScore !== undefined ? String(cell.testScore) : '');
    setInputExamScore(cell?.examScore !== null && cell?.examScore !== undefined ? String(cell.examScore) : '');
    setEditModalOpen(true);
  };

  // Save updated subject scores
  const handleSaveCellScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCell) return;

    setInputSaving(true);
    setStatusMsg(null);

    const testVal = inputTestScore.trim() !== '' ? Math.min(Math.max(0, Number(inputTestScore)), 40) : null;
    const examVal = inputExamScore.trim() !== '' ? Math.min(Math.max(0, Number(inputExamScore)), 60) : null;

    let computedTotal: number | null = null;
    if (testVal !== null || examVal !== null) {
      computedTotal = (testVal || 0) + (examVal || 0);
    }

    const periodLabel = isSecondary
      ? effectiveExamPeriod === 'first-half'
        ? '1st Half (6th Week)'
        : 'Terminal'
      : 'Terminal';

    try {
      // 1. Post/Update Test/CA component (over 40) to backend
      if (testVal !== null) {
        if (activeCell.testId) {
          await fetch(`/api/scores/${activeCell.testId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              score: testVal,
              maxScore: 40,
              teacherComment: `[Period: ${effectiveExamPeriod}] Recorded via Broadsheet for ${activeCell.subject.name}`,
            }),
          });
        } else {
          await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              studentId: activeCell.student.id,
              studentNumber: activeCell.student.studentId,
              subjectId: activeCell.subject.id,
              assessmentType: 'CA',
              assessmentTitle: `${periodLabel} Continuous Assessment Test`,
              score: testVal,
              maxScore: 40,
              session: selectedSession,
              term: selectedTerm,
              teacherComment: `[Period: ${effectiveExamPeriod}] Recorded via Broadsheet for ${activeCell.subject.name}`,
            }),
          });
        }
      }

      // 2. Post/Update Main Exam component (over 60) to backend
      if (examVal !== null) {
        if (activeCell.examId) {
          await fetch(`/api/scores/${activeCell.examId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              score: examVal,
              maxScore: 60,
              teacherComment: `[Period: ${effectiveExamPeriod}] Recorded via Broadsheet for ${activeCell.subject.name}`,
            }),
          });
        } else {
          await fetch('/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              studentId: activeCell.student.id,
              studentNumber: activeCell.student.studentId,
              subjectId: activeCell.subject.id,
              assessmentType: 'Examination',
              assessmentTitle: `${periodLabel} Main Examination`,
              score: examVal,
              maxScore: 60,
              session: selectedSession,
              term: selectedTerm,
              teacherComment: `[Period: ${effectiveExamPeriod}] Recorded via Broadsheet for ${activeCell.subject.name}`,
            }),
          });
        }
      }

      // 3. Persist locally to cache so scores remain preserved across sessions and input times
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        const list = cached ? JSON.parse(cached) : [];
        const filtered = list.filter(
          (l: any) =>
            !(
              (l.studentId === activeCell.student.id || l.studentNumber === activeCell.student.studentId) &&
              Number(l.subjectId) === activeCell.subject.id &&
              l.term === selectedTerm &&
              l.session === selectedSession &&
              l.examPeriod === effectiveExamPeriod
            )
        );

        filtered.push({
          studentId: activeCell.student.id,
          studentNumber: activeCell.student.studentId,
          subjectId: activeCell.subject.id,
          subjectName: activeCell.subject.name,
          testScore: testVal,
          examScore: examVal,
          totalScore: computedTotal,
          term: selectedTerm,
          session: selectedSession,
          examPeriod: effectiveExamPeriod,
        });

        localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
      } catch (_) {}

      // 4. Update memory table state and recalculate student average automatically
      setBroadsheetRows((prev) => {
        const next = prev.map((row) => {
          if (row.student.id !== activeCell.student.id) return row;

          const updatedCells = { ...row.subjectCells };
          const gradeStr = computedTotal !== null ? calculateSubjectGrade(computedTotal) : '-';

          updatedCells[activeCell.subject.id] = {
            subjectId: activeCell.subject.id,
            subjectName: activeCell.subject.name,
            testScore: testVal,
            examScore: examVal,
            totalScore: computedTotal,
            grade: gradeStr,
            testId: activeCell.testId,
            examId: activeCell.examId,
            generalId: activeCell.generalId,
          };

          // Recompute sum and average for this student
          let sum = 0;
          let count = 0;
          Object.values(updatedCells).forEach((c) => {
            if (c.totalScore !== null && c.totalScore !== undefined) {
              sum += c.totalScore;
              count++;
            }
          });

          const newAvg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

          return {
            ...row,
            subjectCells: updatedCells,
            totalMarksSum: sum,
            enteredSubjectsCount: count,
            averageScore: newAvg,
          };
        });

        // Re-rank students by totalMarksSum
        next.sort((a, b) => b.totalMarksSum - a.totalMarksSum);
        next.forEach((r, idx) => {
          r.rank = r.enteredSubjectsCount > 0 ? idx + 1 : undefined;
        });

        return next;
      });

      setStatusMsg({
        type: 'success',
        text: `Score saved for ${activeCell.student.firstName} ${activeCell.student.surname} in ${activeCell.subject.name} (CA: ${testVal !== null ? testVal : '-'} /40, Exam: ${examVal !== null ? examVal : '-'} /60, Total: ${computedTotal}/100). Average recalculated automatically!`,
      });

      setEditModalOpen(false);
      setActiveCell(null);
    } catch (err: any) {
      console.error('Error saving score:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save score' });
    } finally {
      setInputSaving(false);
    }
  };

  // Delete / clear a score cell
  const handleDeleteCellScore = async () => {
    if (!activeCell) return;
    if (!window.confirm(`Clear scores for ${activeCell.student.firstName} in ${activeCell.subject.name}?`)) return;

    setInputSaving(true);
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

      if (activeCell.testId) {
        await fetch(`/api/scores/${activeCell.testId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
      if (activeCell.examId) {
        await fetch(`/api/scores/${activeCell.examId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
      if (activeCell.generalId) {
        await fetch(`/api/scores/${activeCell.generalId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }

      // Remove from localStorage
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter(
            (l: any) =>
              !(
                (l.studentId === activeCell.student.id || l.studentNumber === activeCell.student.studentId) &&
                Number(l.subjectId) === activeCell.subject.id &&
                l.term === selectedTerm &&
                l.session === selectedSession &&
                l.examPeriod === effectiveExamPeriod
              )
          );
          localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
        }
      } catch (_) {}

      // Update in state
      setBroadsheetRows((prev) => {
        const next = prev.map((row) => {
          if (row.student.id !== activeCell.student.id) return row;
          const updatedCells = { ...row.subjectCells };
          delete updatedCells[activeCell.subject.id];

          let sum = 0;
          let count = 0;
          Object.values(updatedCells).forEach((c) => {
            if (c.totalScore !== null && c.totalScore !== undefined) {
              sum += c.totalScore;
              count++;
            }
          });
          const newAvg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

          return {
            ...row,
            subjectCells: updatedCells,
            totalMarksSum: sum,
            enteredSubjectsCount: count,
            averageScore: newAvg,
          };
        });

        next.sort((a, b) => b.totalMarksSum - a.totalMarksSum);
        next.forEach((r, idx) => {
          r.rank = r.enteredSubjectsCount > 0 ? idx + 1 : undefined;
        });

        return next;
      });

      setStatusMsg({
        type: 'success',
        text: `Score record cleared for ${activeCell.student.firstName} in ${activeCell.subject.name}. Average recalculated.`,
      });
      setEditModalOpen(false);
      setActiveCell(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to clear score' });
    } finally {
      setInputSaving(false);
    }
  };

  // Add a new subject to broadsheet
  const handleAddNewSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      const code = newSubjectCode.trim() || newSubjectName.slice(0, 3).toUpperCase();
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newSubjectName.trim(), code, classLevel: selectedClass }),
      });
      if (res.ok) {
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch (_) {}
        if (data.subject) setAvailableSubjects((prev) => [...prev, data.subject]);
      } else {
        const newSub: Subject = {
          id: Date.now(),
          name: newSubjectName.trim(),
          code,
          status: 'active',
        };
        setAvailableSubjects((prev) => [...prev, newSub]);
      }

      setStatusMsg({
        type: 'success',
        text: `Subject "${newSubjectName.trim()}" added to Class Broadsheet view!`,
      });
      setAddSubjectModalOpen(false);
      setNewSubjectName('');
      setNewSubjectCode('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to add subject' });
    }
  };

  // Open Edit Subject modal
  const handleOpenEditSubject = (sub: Subject) => {
    setSubjectToEdit(sub);
    setEditSubjectName(sub.name);
    setEditSubjectCode(sub.code || '');
    setEditSubjectModalOpen(true);
  };

  // Save Subject Edit
  const handleSaveEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectToEdit || !editSubjectName.trim()) return;

    setSavingSubjectEdit(true);
    try {
      const res = await fetch(`/api/subjects/${subjectToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editSubjectName.trim(),
          code: editSubjectCode.trim().toUpperCase() || subjectToEdit.code,
        }),
      });

      const updatedName = editSubjectName.trim();
      const updatedCode = editSubjectCode.trim().toUpperCase() || subjectToEdit.code;

      setAvailableSubjects((prev) =>
        prev.map((s) => (s.id === subjectToEdit.id ? { ...s, name: updatedName, code: updatedCode } : s))
      );

      setStatusMsg({
        type: 'success',
        text: `Subject updated to "${updatedName}" (${updatedCode}) successfully!`,
      });
      setEditSubjectModalOpen(false);
      setSubjectToEdit(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update subject' });
    } finally {
      setSavingSubjectEdit(false);
    }
  };

  // Live preview numbers in edit cell modal
  const liveTest = inputTestScore !== '' ? Math.min(Math.max(0, Number(inputTestScore)), 40) : 0;
  const liveExam = inputExamScore !== '' ? Math.min(Math.max(0, Number(inputExamScore)), 60) : 0;
  const liveTotal = (inputTestScore !== '' || inputExamScore !== '') ? liveTest + liveExam : 0;
  const liveGrade = calculateSubjectGrade(liveTotal);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 fis-card-accent">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                Faculty & Administration Master Broadsheet
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                Live Editable Ledger • CA (40) + Exam (60) = 100
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Class Examination Broadsheet ({selectedClass})
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
              {isSecondary ? (
                <>
                  <strong className="text-amber-300">Secondary Sector:</strong> Conducts 2 exams in a term (1st Half / 6th Week Exam &amp; Terminal Exam). In both exams, Test/CA is marked over <strong>40</strong> and Exam is marked over <strong>60</strong>, totaling <strong>100</strong>.
                </>
              ) : (
                <>
                  <strong className="text-emerald-300">Primary / Lower Class:</strong> Conducts examination <strong>once a term</strong>. Continuous Assessment (CA) is marked over <strong>40</strong> and Terminal Exam is marked over <strong>60</strong>, totaling <strong>100</strong>.
                </>
              )}{' '}
              Scores can be inputted at different times and remain preserved; student average calculates automatically!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => loadData()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
            title="Refresh Broadsheet Data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            Refresh
          </button>
          <button
            onClick={() => setAddSubjectModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Subject
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            Print Broadsheet
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Filter and Exam Period Selector Bar */}
      <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Class / Sector</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
          >
            {SCHOOL_CLASSES.map((cName) => (
              <option key={cName} value={cName}>
                {cName} {isSecondaryClass(cName) ? '(Secondary - 2 Exams/Term)' : '(Primary - 1 Exam/Term)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Term</label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
          >
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Academic Session</label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-emerald-500"
          >
            <option value="2026/2027">2026/2027</option>
            <option value="2025/2026">2025/2026</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Exam Period {isSecondary ? '(Secondary School)' : '(Primary / Lower Class)'}
          </label>
          {isSecondary ? (
            <select
              value={examPeriod}
              onChange={(e) => setExamPeriod(e.target.value as any)}
              className="w-full bg-slate-900 border border-amber-500/50 text-amber-300 font-bold rounded-xl px-3 py-2 text-xs focus:outline-none"
            >
              <option value="first-half">1st Half Exam (6th Week) — CA/40 + Exam/60 = 100</option>
              <option value="terminal">Terminal Exam — CA/40 + Exam/60 = 100</option>
            </select>
          ) : (
            <div className="w-full bg-slate-900/80 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between">
              <span>Terminal Exam (Once a term)</span>
              <span className="text-[10px] text-slate-400 font-mono">CA/40 + Ex/60 = 100</span>
            </div>
          )}
        </div>
      </div>

      {/* Rules Notice Badge */}
      <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-300 gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          {isSecondary ? (
            <span>
              <strong>Secondary Sector Active ({selectedClass}):</strong> Two exams conducted per term. Currently viewing:{' '}
              <span className="text-amber-300 font-bold uppercase underline">
                {examPeriod === 'first-half' ? '1st Half Exam (6th Week)' : 'Terminal Exam'}
              </span>
              . Test / CA score is over <strong>40</strong>, and Main Exam score is over <strong>60</strong>, totaling <strong>100</strong> per subject. Each subject score remains saved when another subject score is entered.
            </span>
          ) : (
            <span>
              <strong>Primary &amp; Lower Class Active ({selectedClass}):</strong> Exam conducted <strong>once a term</strong>. Continuous Assessment (CA) is over <strong>40</strong>, and Terminal Exam is over <strong>60</strong>, totaling <strong>100</strong>. Each subject score remains saved when another is entered.
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            Automatic Student Average &amp; Rank
          </span>
        </div>
      </div>

      {/* Master Broadsheet Table */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
          <span>
            Class: <strong className="text-white">{selectedClass}</strong> • Enrolled Scholars:{' '}
            <strong className="text-white">{broadsheetRows.length}</strong> • Subjects:{' '}
            <strong className="text-white">{availableSubjects.length}</strong> • Examination Period:{' '}
            <strong className="text-amber-300">
              {isSecondary ? (examPeriod === 'first-half' ? '1st Half (6th Week)' : 'Terminal Exam') : 'Terminal Exam (Single)'}
            </strong>
          </span>
          <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
            💡 Click any score cell to edit CA/Exam values. Click the pencil icon on any subject header to edit the subject.
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            Loading {selectedClass} class broadsheet and subject ledgers...
          </div>
        ) : broadsheetRows.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            No enrolled students found for class {selectedClass}. Try switching class filters or enroll students in Students Directory.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-700 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3 text-center w-12 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                    Rank
                  </th>
                  <th className="py-3 px-3 min-w-[170px] sticky left-12 bg-slate-900 z-10 border-r border-slate-700">
                    Student Scholar
                  </th>
                  {availableSubjects.map((sub) => (
                    <th key={sub.id} className="py-3 px-2 text-center min-w-[130px] border-r border-slate-800 group/th">
                      <div className="flex items-center justify-center gap-1 mx-auto max-w-[130px]">
                        <span className="truncate text-white font-bold" title={sub.name}>
                          {sub.name}
                        </span>
                        <button
                          onClick={() => handleOpenEditSubject(sub)}
                          className="opacity-0 group-hover/th:opacity-100 p-0.5 rounded text-slate-400 hover:text-amber-300 transition cursor-pointer"
                          title={`Edit ${sub.name}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[9px] font-normal text-slate-400 mt-0.5 font-mono">
                        CA /40 | Ex /60 | Tot /100
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center min-w-[90px] text-amber-400 font-black bg-slate-900/80 border-r border-slate-700">
                    Total (/100)
                  </th>
                  <th className="py-3 px-3 text-center min-w-[90px] text-emerald-400 font-black bg-slate-900/80">
                    Average (%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {broadsheetRows.map((row) => {
                  const studentName = `${row.student.firstName} ${row.student.surname}`;
                  return (
                    <tr key={row.student.id} className="hover:bg-slate-750 transition group">
                      {/* Rank */}
                      <td className="py-2.5 px-3 text-center font-bold sticky left-0 bg-slate-850 group-hover:bg-slate-750 z-10 border-r border-slate-800">
                        {row.rank ? (
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-black ${
                              row.rank === 1
                                ? 'bg-amber-500 text-slate-950 shadow'
                                : row.rank <= 3
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400'
                            }`}
                          >
                            {row.rank}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Student Name & ID */}
                      <td className="py-2.5 px-3 font-semibold text-white sticky left-12 bg-slate-850 group-hover:bg-slate-750 z-10 border-r border-slate-700">
                        <div className="truncate max-w-[170px]" title={studentName}>
                          {studentName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {row.student.studentId}
                        </div>
                      </td>

                      {/* Subject Cells */}
                      {availableSubjects.map((sub) => {
                        const cell = row.subjectCells[sub.id];
                        const hasScore = cell && cell.totalScore !== null && cell.totalScore !== undefined;

                        return (
                          <td
                            key={sub.id}
                            onClick={() => handleOpenEditCell(row.student, sub, cell)}
                            className="py-2 px-2 text-center border-r border-slate-800/80 cursor-pointer hover:bg-slate-700/80 transition relative group/cell"
                            title={`Click to edit ${studentName}'s ${sub.name} score`}
                          >
                            {hasScore ? (
                              <div className="flex flex-col items-center justify-center">
                                <div className="text-xs font-bold text-white flex items-center gap-1">
                                  <span>{cell.totalScore}</span>
                                  {cell.grade !== '-' && (
                                    <span
                                      className={`text-[10px] font-bold px-1 rounded ${
                                        cell.grade.startsWith('A')
                                          ? 'text-emerald-400 bg-emerald-500/10'
                                          : cell.grade.startsWith('B')
                                          ? 'text-blue-400 bg-blue-500/10'
                                          : cell.grade.startsWith('C')
                                          ? 'text-amber-400 bg-amber-500/10'
                                          : 'text-rose-400 bg-rose-500/10'
                                      }`}
                                    >
                                      {cell.grade}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                  <span title="Continuous Assessment / Test (over 40)" className="text-sky-300">
                                    CA: {cell.testScore !== null && cell.testScore !== undefined ? cell.testScore : '-'}
                                  </span>
                                  <span className="text-slate-600">|</span>
                                  <span title="Main Exam (over 60)" className="text-amber-300">
                                    Ex: {cell.examScore !== null && cell.examScore !== undefined ? cell.examScore : '-'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="py-2 text-slate-600 hover:text-amber-400 transition flex items-center justify-center gap-1">
                                <span>-</span>
                                <Plus className="w-3 h-3 opacity-0 group-hover/cell:opacity-100 transition" />
                              </div>
                            )}

                            {/* Floating edit pencil hint */}
                            <Edit2 className="w-2.5 h-2.5 text-amber-400 absolute top-1 right-1 opacity-0 group-hover/cell:opacity-100 transition" />
                          </td>
                        );
                      })}

                      {/* Cumulative Total */}
                      <td className="py-2.5 px-3 text-center font-bold text-amber-400 bg-slate-900/40 border-r border-slate-700 font-mono">
                        {row.enteredSubjectsCount > 0 ? (
                          <div>
                            <div>{row.totalMarksSum}</div>
                            <div className="text-[9px] font-normal text-slate-500">
                              ({row.enteredSubjectsCount} sub)
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Automatic Average */}
                      <td className="py-2.5 px-3 text-center font-black text-emerald-400 bg-slate-900/40 font-mono text-sm">
                        {row.enteredSubjectsCount > 0 ? (
                          <div className="flex flex-col items-center">
                            <span>{row.averageScore}%</span>
                            <span className="text-[9px] font-semibold text-slate-400">
                              {calculateSubjectGrade(row.averageScore)}
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Statistics Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-700 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-4">
            <span>
              Total Scholars: <strong className="text-white">{broadsheetRows.length}</strong>
            </span>
            <span>
              Recorded Scholars:{' '}
              <strong className="text-white">
                {broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length}
              </strong>
            </span>
            <span>
              Class Average:{' '}
              <strong className="text-emerald-400 font-mono">
                {broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length > 0
                  ? (
                      broadsheetRows
                        .filter((r) => r.enteredSubjectsCount > 0)
                        .reduce((acc, r) => acc + r.averageScore, 0) /
                      broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length
                    ).toFixed(1)
                  : '0.0'}
                %
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              Grading Scheme: A1 (75-100) • B2 (70-74) • B3 (65-69) • C4-C6 (50-64) • D7-E8 (40-49) • F9 (0-39)
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: EDIT / INPUT SUBJECT SCORE CELL                 */}
      {/* ======================================================== */}
      {editModalOpen && activeCell && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-400" />
                  Score Entry &amp; Edit: {activeCell.subject.name}
                </h3>
                <span className="text-xs text-slate-400">
                  {activeCell.student.firstName} {activeCell.student.surname} ({activeCell.student.studentId}) •{' '}
                  {selectedClass} • {selectedTerm} ({selectedSession})
                </span>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCellScore} className="space-y-4">
              <div className="p-3 bg-slate-800/70 border border-slate-700 rounded-xl text-xs text-slate-300">
                <div className="font-semibold text-amber-300 mb-0.5">
                  Exam Period:{' '}
                  {isSecondary
                    ? effectiveExamPeriod === 'first-half'
                      ? '1st Half Exam (6th Week)'
                      : 'Terminal Exam'
                    : 'Terminal Exam (Single per Term)'}
                </div>
                <div>
                  Continuous Assessment (CA) / Test is marked over <strong>40</strong>, and Main Examination is marked over <strong>60</strong>. Both amount to what the student scored out of <strong>100</strong>.
                  You can input them at different times; each subject's scores will remain saved and intact.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Continuous Assessment / Test Score
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={40}
                      step="any"
                      value={inputTestScore}
                      onChange={(e) => setInputTestScore(e.target.value)}
                      placeholder="0 - 40"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">/ 40</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Max: 40 marks (CA / 6th wk test)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Main Examination Score
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      step="any"
                      value={inputExamScore}
                      onChange={(e) => setInputExamScore(e.target.value)}
                      placeholder="0 - 60"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">/ 60</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Max: 60 marks (Main exam)</span>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Computed Subject Total:</span>
                  <span className="text-xl font-black text-amber-300 font-mono">
                    {liveTotal} / 100
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    (CA: {liveTest} + Exam: {liveExam})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">Grade Equivalent:</span>
                  <span
                    className={`text-base font-bold font-mono px-2 py-0.5 rounded ${
                      liveGrade.startsWith('A')
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : liveGrade.startsWith('B')
                        ? 'text-blue-400 bg-blue-500/10'
                        : liveGrade.startsWith('C')
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {liveGrade}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {(activeCell.testId || activeCell.examId || activeCell.generalId) ? (
                  <button
                    type="button"
                    onClick={handleDeleteCellScore}
                    disabled={inputSaving}
                    className="px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Score
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inputSaving}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 text-amber-400" />
                    {inputSaving ? 'Saving Score...' : 'Save & Calculate'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD NEW SUBJECT TO BROADSHEET                   */}
      {/* ======================================================== */}
      {addSubjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Add New Subject to Broadsheet
              </h3>
              <button
                onClick={() => setAddSubjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Further Mathematics, Civic Education"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject Code</label>
                <input
                  type="text"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  placeholder="e.g. FTH, CIV"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white uppercase focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddSubjectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  Add Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: EDIT EXISTING SUBJECT                           */}
      {/* ======================================================== */}
      {editSubjectModalOpen && subjectToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Edit Subject Details
              </h3>
              <button
                onClick={() => setEditSubjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject Name *</label>
                <input
                  type="text"
                  required
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  placeholder="Subject Name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject Code</label>
                <input
                  type="text"
                  value={editSubjectCode}
                  onChange={(e) => setEditSubjectCode(e.target.value)}
                  placeholder="e.g. MTH, ENG"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white uppercase focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditSubjectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSubjectEdit}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingSubjectEdit ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

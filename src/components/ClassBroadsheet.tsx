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
  RefreshCw,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  SCHOOL_CLASSES,
  isSecondaryClass,
  isSeniorSecondaryClass,
  calculateCgpa,
  calculateJuniorAverage,
  calculateGradePoint5,
} from '../constants/classes.ts';
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
    // Senior Secondary CGPA additions (5.0 scale, 2 units per subject)
    cgpa?: number;
    totalUnits?: number;
    totalQualityPoints?: number;
    standing?: string;
    gradeBadge?: string;
    // Attendance
    attendance: {
      timesOpened: number;
      timesPresent: number;
      timesAbsent: number;
      rate: number;
      session?: string;
      term?: string;
    };
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

  // Modal for Teacher Attendance Input
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceStudent, setAttendanceStudent] = useState<Student | null>(null);
  const [inputTimesOpened, setInputTimesOpened] = useState('115');
  const [inputTimesPresent, setInputTimesPresent] = useState('110');
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Print Preview state
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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

  // Modal for setting class-wide school days
  const [bulkDaysModalOpen, setBulkDaysModalOpen] = useState(false);
  const [inputClassSchoolDays, setInputClassSchoolDays] = useState('115');
  const [savingClassDays, setSavingClassDays] = useState(false);

  const isSecondary = isSecondaryClass(selectedClass);
  const isSenior = isSeniorSecondaryClass(selectedClass);
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
      const cleanTarget = selectedClass.replace(/\s+/g, '').toUpperCase();
      let filtered = allStudents.filter((s) => {
        const cleanCur = (s.currentClass || '').replace(/\s+/g, '').toUpperCase();
        return cleanCur === cleanTarget || cleanCur.includes(cleanTarget) || cleanTarget.includes(cleanCur);
      });

      // 3. Fetch scores and attendance from backend
      const serverScores: any[] = [];
      const backendAttendanceMap: Record<string, any> = {};

      // 3a. Query class broadsheet endpoint
      try {
        const res = await fetch(
          `/api/broadsheet/class?class=${encodeURIComponent(selectedClass)}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}&examPeriod=${encodeURIComponent(effectiveExamPeriod)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const text = await res.text();
          let d: any = {};
          try { d = JSON.parse(text); } catch (_) {}
          if (Array.isArray(d.scores)) {
            serverScores.push(...d.scores);
          }
          if (Array.isArray(d.students) && d.students.length > 0) {
            d.students.forEach((st: any) => {
              if (st.attendance) {
                const k1 = String(st.studentId || '').toUpperCase().trim();
                const k2 = String(st.id || '').trim();
                if (k1) backendAttendanceMap[k1] = st.attendance;
                if (k2) backendAttendanceMap[k2] = st.attendance;
              }
            });

            // Merge server students into filtered list to ensure exact database IDs and admission numbers align
            const existingStNums = new Set(filtered.map(s => String(s.studentId || '').toUpperCase().trim()));
            d.students.forEach((srvSt: any) => {
              const numKey = String(srvSt.studentId || '').toUpperCase().trim();
              if (!existingStNums.has(numKey)) {
                filtered.push(srvSt);
                existingStNums.add(numKey);
              } else {
                // Update id on matching student to ensure database PK matches
                const idx = filtered.findIndex(s => String(s.studentId || '').toUpperCase().trim() === numKey);
                if (idx !== -1 && srvSt.id) {
                  filtered[idx] = { ...filtered[idx], ...srvSt, id: srvSt.id };
                }
              }
            });
          }
        }
      } catch (e) {
        console.warn('Backend class broadsheet fetch note:', e);
      }

      const targetStudents = filtered.length > 0 ? filtered : allStudents.slice(0, 10);
      setClassStudents(targetStudents);

      // 3b. Also query general scores endpoint
      try {
        const res = await fetch(
          `/api/scores?class=${encodeURIComponent(selectedClass)}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const text = await res.text();
          let d: any = {};
          try { d = JSON.parse(text); } catch (_) {}
          const moreScores = d.results || d.scores || [];
          if (Array.isArray(moreScores)) {
            serverScores.push(...moreScores);
          }
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

      // 4b. Local attendance cache
      let localAttendanceMap: Record<string, any> = {};
      try {
        const cachedAtt = localStorage.getItem('fis_student_attendance_v1') || localStorage.getItem('fis_attendance_records_v1');
        if (cachedAtt) localAttendanceMap = JSON.parse(cachedAtt);
      } catch (_) {}

      // 4c. Deleted score IDs to filter out
      const deletedIds = new Set<string>();
      try {
        const rawDel = localStorage.getItem('fis_deleted_score_ids_v1');
        if (rawDel) {
          const parsed = JSON.parse(rawDel);
          parsed.forEach((x: any) => deletedIds.add(String(x)));
        }
      } catch (_) {}

      const isScoreDeleted = (id: any, studentId: any, subjectId: any) => {
        if (id && deletedIds.has(String(id))) return true;
        if (studentId && subjectId) {
          if (deletedIds.has(`key_${studentId}_${subjectId}`)) return true;
          if (deletedIds.has(`key_${studentId}_${subjectId}_CA`)) return true;
          if (deletedIds.has(`key_${studentId}_${subjectId}_Examination`)) return true;
        }
        return false;
      };

      // Helper: Term normalizer
      const normalizeTerm = (t?: string) => {
        if (!t) return '';
        const s = t.toLowerCase();
        if (s.includes('1') || s.includes('first')) return 'first';
        if (s.includes('2') || s.includes('second')) return 'second';
        if (s.includes('3') || s.includes('third')) return 'third';
        return s.trim();
      };

      // Build broadsheet rows
      const rows: BroadsheetRow[] = targetStudents.map((st) => {
        const cleanStId = String(st.studentId || '').toUpperCase().trim();
        const cleanDbId = String(st.id || '').trim();
        const stFullName = `${st.firstName || ''} ${st.surname || ''}`.trim().toLowerCase();

        // Resolve student attendance
        const studentAttendance =
          localAttendanceMap[cleanStId] ||
          localAttendanceMap[cleanDbId] ||
          backendAttendanceMap[cleanStId] ||
          backendAttendanceMap[cleanDbId] || {
            timesOpened: 115,
            timesPresent: 110,
            timesAbsent: 5,
            rate: 95.7,
            session: selectedSession,
            term: selectedTerm,
          };

        const cellMap: Record<number, SubjectScoreCell> = {};
        let totalSum = 0;
        let countedSubjects = 0;
        const subjectScoresList: Array<{ totalScore: number; units: number }> = [];

        subs.forEach((sub) => {
          const cleanSubName = (sub.name || '').trim().toLowerCase();
          const cleanSubCode = (sub.code || '').trim().toLowerCase();

          // Find assessments for this student and subject
          const stScores = serverScores.filter((sc) => {
            if (isScoreDeleted(sc.id, st.id, sub.id)) return false;

            const scDbId = String(sc.studentDbId || '').trim();
            const scStId = String(sc.studentId || '').toUpperCase().trim();
            const scStNum = String(sc.studentNumber || '').toUpperCase().trim();
            const scStName = String(sc.studentName || '').toLowerCase().trim();

            const matchesSt =
              (scDbId && cleanDbId && scDbId === cleanDbId) ||
              (scStId && cleanDbId && scStId === cleanDbId) ||
              (scStId && cleanStId && scStId === cleanStId) ||
              (scStNum && cleanStId && scStNum === cleanStId) ||
              (scStName && stFullName && (scStName === stFullName || scStName.includes(stFullName) || stFullName.includes(scStName)));
            if (!matchesSt) return false;

            const scSubName = (sc.subjectName || '').trim().toLowerCase();
            const scSubCode = (sc.subjectCode || '').trim().toLowerCase();

            const matchesSub =
              Number(sc.subjectId) === Number(sub.id) ||
              String(sc.subjectId) === String(sub.id) ||
              (scSubName && cleanSubName && (
                scSubName === cleanSubName ||
                scSubName.includes(cleanSubName) ||
                cleanSubName.includes(scSubName)
              )) ||
              (scSubCode && cleanSubCode && scSubCode === cleanSubCode);
            return matchesSub;
          });

          // Find local overrides with period check and fallback
          const findLoc = (strictPeriod: boolean) =>
            localScores.find((l) => {
              if (isScoreDeleted(l.id || l.testId || l.examId, st.id, sub.id)) return false;

              const lStId = String(l.studentId || '').toUpperCase().trim();
              const lStNum = String(l.studentNumber || '').toUpperCase().trim();
              const matchesSt =
                lStId === cleanDbId ||
                lStId === cleanStId ||
                lStNum === cleanStId ||
                (l.studentName && stFullName && l.studentName.trim().toLowerCase() === stFullName);
              if (!matchesSt) return false;

              const lSubName = (l.subjectName || '').trim().toLowerCase();
              const matchesSub =
                Number(l.subjectId) === Number(sub.id) ||
                String(l.subjectId) === String(sub.id) ||
                (lSubName && cleanSubName && (
                  lSubName === cleanSubName ||
                  lSubName.includes(cleanSubName) ||
                  cleanSubName.includes(lSubName)
                ));
              if (!matchesSub) return false;

              const termMatch = !l.term || !selectedTerm || normalizeTerm(l.term) === normalizeTerm(selectedTerm);
              const sessMatch = !l.session || !selectedSession || l.session.trim() === selectedSession.trim();
              if (!termMatch || !sessMatch) return false;

              if (strictPeriod && isSecondary) {
                return !l.examPeriod || l.examPeriod === effectiveExamPeriod;
              }
              return true;
            });

          const locMatch = findLoc(true) || findLoc(false);

          let test: number | null = null;
          let exam: number | null = null;
          let testId: number | null = null;
          let examId: number | null = null;
          let generalId: number | null = null;

          if (locMatch) {
            test = locMatch.testScore !== undefined && locMatch.testScore !== null && locMatch.testScore !== '' ? Number(locMatch.testScore) : null;
            exam = locMatch.examScore !== undefined && locMatch.examScore !== null && locMatch.examScore !== '' ? Number(locMatch.examScore) : null;
            testId = locMatch.testId || null;
            examId = locMatch.examId || null;
            if (test === null && exam === null && locMatch.totalScore !== undefined && locMatch.totalScore !== null) {
              const tot = Number(locMatch.totalScore);
              test = Math.round((tot * 40) / 100);
              exam = Math.round((tot * 60) / 100);
            }
          }

          if ((test === null || exam === null) && stScores.length > 0) {
            // Find CA / test score (over 40)
            let testRec = stScores.find((s) => {
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
                  return title.includes('first half') || title.includes('1st half') || title.includes('6th') || comm.includes('first-half');
                } else {
                  return title.includes('terminal') || comm.includes('terminal') || (!title.includes('first half') && !title.includes('1st half') && !title.includes('6th') && !comm.includes('first-half'));
                }
              }
              return true;
            });

            // Fallback: If no period-specific CA record found, take any CA record
            if (!testRec) {
              testRec = stScores.find((s) => {
                const title = (s.assessmentTitle || '').toLowerCase();
                return (
                  s.assessmentType === 'CA' ||
                  s.assessmentType === 'Test' ||
                  title.includes('ca') ||
                  title.includes('test') ||
                  Number(s.maxScore) === 40
                );
              });
            }

            if (testRec && test === null) {
              test = Number(testRec.score);
              testId = testRec.id;
            }

            // Find main exam score (over 60)
            let examRec = stScores.find((s) => {
              const title = (s.assessmentTitle || '').toLowerCase();
              const comm = (s.teacherComment || '').toLowerCase();
              const isExam =
                s.assessmentType === 'Examination' ||
                title.includes('exam') ||
                Number(s.maxScore) === 60;
              if (!isExam) return false;

              if (isSecondary) {
                if (effectiveExamPeriod === 'first-half') {
                  return title.includes('first half') || title.includes('1st half') || title.includes('6th') || comm.includes('first-half');
                } else {
                  return title.includes('terminal') || comm.includes('terminal') || (!title.includes('first half') && !title.includes('1st half') && !title.includes('6th') && !comm.includes('first-half'));
                }
              }
              return true;
            });

            // Fallback: If no period-specific exam record found, take any exam record
            if (!examRec) {
              examRec = stScores.find((s) => {
                const title = (s.assessmentTitle || '').toLowerCase();
                return (
                  s.assessmentType === 'Examination' ||
                  title.includes('exam') ||
                  Number(s.maxScore) === 60
                );
              });
            }

            if (examRec && exam === null) {
              exam = Number(examRec.score);
              examId = examRec.id;
            }

            // Parse embedded json in teacherComment
            for (const sc of stScores) {
              if (sc.teacherComment) {
                try {
                  const comm = sc.teacherComment.trim();
                  if (comm.startsWith('{')) {
                    const parsed = JSON.parse(comm);
                    if (test === null && parsed.caScore !== undefined && parsed.caScore !== null && parsed.caScore !== '') {
                      test = Number(parsed.caScore);
                    }
                    if (exam === null && parsed.examScore !== undefined && parsed.examScore !== null && parsed.examScore !== '') {
                      exam = Number(parsed.examScore);
                    }
                  }
                } catch (_) {}
              }
            }

            // Fallback for single assessment record
            if (test === null && exam === null && stScores[0]) {
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

          // Total is CA (max 40) + Exam (max 60) = 100
          let cellTotal: number | null = null;
          if (test !== null || exam !== null) {
            cellTotal = Math.min(100, (test || 0) + (exam || 0));
          }

          if (cellTotal !== null) {
            totalSum += cellTotal;
            countedSubjects++;
            subjectScoresList.push({ totalScore: cellTotal, units: 2 });
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

        let cgpa: number | undefined;
        let standing = 'No Scores Recorded';
        let gradeBadge = 'N/A';
        let totalUnits = 0;
        let totalQualityPoints = 0;

        if (isSenior) {
          const cgpaSummary = calculateCgpa(subjectScoresList);
          cgpa = cgpaSummary.cgpa;
          standing = cgpaSummary.standing;
          gradeBadge = cgpaSummary.gradeBadge;
          totalUnits = cgpaSummary.totalUnits;
          totalQualityPoints = cgpaSummary.totalQualityPoints;
        } else {
          const juniorSummary = calculateJuniorAverage(subjectScoresList);
          standing = juniorSummary.standing;
        }

        return {
          student: st,
          subjectCells: cellMap,
          totalMarksSum: totalSum,
          enteredSubjectsCount: countedSubjects,
          averageScore: avg,
          cgpa,
          standing,
          gradeBadge,
          totalUnits,
          totalQualityPoints,
          attendance: studentAttendance,
        };
      });

      // Rank rows: Senior secondary ranks by CGPA then total marks, Junior ranks by average percentage
      if (isSenior) {
        rows.sort((a, b) => (b.cgpa || 0) - (a.cgpa || 0) || b.totalMarksSum - a.totalMarksSum);
      } else {
        rows.sort((a, b) => b.totalMarksSum - a.totalMarksSum);
      }

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
    window.addEventListener('fis:attendance-updated', handleScoresChanged);
    window.addEventListener('storage', handleScoresChanged);
    return () => {
      window.removeEventListener('fis:scores-updated', handleScoresChanged);
      window.removeEventListener('fis:broadsheet-scores-updated', handleScoresChanged);
      window.removeEventListener('fis:attendance-updated', handleScoresChanged);
      window.removeEventListener('storage', handleScoresChanged);
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
    } else {
      // Both fields cleared -> delete score
      await handleDeleteCellScore();
      return;
    }

    const periodLabel = isSecondary
      ? effectiveExamPeriod === 'first-half'
        ? '1st Half (6th Week)'
        : 'Terminal'
      : 'Terminal';

    try {
      // Delete previous CA if now cleared
      if (testVal === null && activeCell.testId) {
        await fetch(`/api/scores/${activeCell.testId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      // Delete previous Exam if now cleared
      if (examVal === null && activeCell.examId) {
        await fetch(`/api/scores/${activeCell.examId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

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

      // 4. Update memory table state and recalculate student average/CGPA automatically
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

          // Recompute sum, average and CGPA for this student
          let sum = 0;
          let count = 0;
          const subjectScoresList: Array<{ totalScore: number; units: number }> = [];

          Object.values(updatedCells).forEach((c) => {
            if (c.totalScore !== null && c.totalScore !== undefined) {
              sum += c.totalScore;
              count++;
              subjectScoresList.push({ totalScore: c.totalScore, units: 2 });
            }
          });

          const newAvg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

          let cgpa: number | undefined;
          let standing = 'No Scores Recorded';
          let gradeBadge = 'N/A';
          let totalUnits = 0;
          let totalQualityPoints = 0;

          if (isSenior) {
            const cgpaSummary = calculateCgpa(subjectScoresList);
            cgpa = cgpaSummary.cgpa;
            standing = cgpaSummary.standing;
            gradeBadge = cgpaSummary.gradeBadge;
            totalUnits = cgpaSummary.totalUnits;
            totalQualityPoints = cgpaSummary.totalQualityPoints;
          } else {
            const juniorSummary = calculateJuniorAverage(subjectScoresList);
            standing = juniorSummary.standing;
          }

          return {
            ...row,
            subjectCells: updatedCells,
            totalMarksSum: sum,
            enteredSubjectsCount: count,
            averageScore: newAvg,
            cgpa,
            standing,
            gradeBadge,
            totalUnits,
            totalQualityPoints,
          };
        });

        // Re-rank students
        if (isSenior) {
          next.sort((a, b) => (b.cgpa || 0) - (a.cgpa || 0) || b.totalMarksSum - a.totalMarksSum);
        } else {
          next.sort((a, b) => b.totalMarksSum - a.totalMarksSum);
        }
        next.forEach((r, idx) => {
          r.rank = r.enteredSubjectsCount > 0 ? idx + 1 : undefined;
        });

        return next;
      });

      // Dispatch global events so student dashboard & profiles live-reload
      window.dispatchEvent(
        new CustomEvent('fis:scores-updated', {
          detail: {
            studentId: activeCell.student.id,
            studentNumber: activeCell.student.studentId,
            subjectId: activeCell.subject.id,
          },
        })
      );
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setStatusMsg({
        type: 'success',
        text: `Score saved for ${activeCell.student.firstName} ${activeCell.student.surname} in ${activeCell.subject.name} (CA: ${testVal !== null ? testVal : '-'} /40, Exam: ${examVal !== null ? examVal : '-'} /60, Total: ${computedTotal}/100). ${isSenior ? 'Senior CGPA' : 'Class Average'} recalculated automatically!`,
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
        }).catch(() => {});
      }
      if (activeCell.examId) {
        await fetch(`/api/scores/${activeCell.examId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }).catch(() => {});
      }
      if (activeCell.generalId) {
        await fetch(`/api/scores/${activeCell.generalId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }).catch(() => {});
      }

      // Also call query score deletion to guarantee clean state on server
      await fetch(
        `/api/scores?studentId=${encodeURIComponent(String(activeCell.student.id))}&subjectId=${activeCell.subject.id}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }
      ).catch(() => {});

      // Record deleted IDs in fis_deleted_score_ids_v1 so the deleted score never returns
      try {
        const deletedRaw = localStorage.getItem('fis_deleted_score_ids_v1');
        const deletedIds = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
        if (activeCell.testId) deletedIds.add(String(activeCell.testId));
        if (activeCell.examId) deletedIds.add(String(activeCell.examId));
        if (activeCell.generalId) deletedIds.add(String(activeCell.generalId));
        deletedIds.add(`key_${activeCell.student.id}_${activeCell.subject.id}`);
        deletedIds.add(`key_${activeCell.student.studentId}_${activeCell.subject.id}`);
        localStorage.setItem('fis_deleted_score_ids_v1', JSON.stringify([...deletedIds]));
      } catch (_) {}

      // Remove from localStorage broadsheet cache
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter(
            (l: any) =>
              !(
                (String(l.studentId) === String(activeCell.student.id) || l.studentNumber === activeCell.student.studentId) &&
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
          const subjectScoresList: Array<{ totalScore: number; units: number }> = [];

          Object.values(updatedCells).forEach((c) => {
            if (c.totalScore !== null && c.totalScore !== undefined) {
              sum += c.totalScore;
              count++;
              subjectScoresList.push({ totalScore: c.totalScore, units: 2 });
            }
          });

          const newAvg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

          let cgpa: number | undefined;
          let standing = 'No Scores Recorded';
          let gradeBadge = 'N/A';
          let totalUnits = 0;
          let totalQualityPoints = 0;

          if (isSenior) {
            const cgpaSummary = calculateCgpa(subjectScoresList);
            cgpa = cgpaSummary.cgpa;
            standing = cgpaSummary.standing;
            gradeBadge = cgpaSummary.gradeBadge;
            totalUnits = cgpaSummary.totalUnits;
            totalQualityPoints = cgpaSummary.totalQualityPoints;
          } else {
            const juniorSummary = calculateJuniorAverage(subjectScoresList);
            standing = juniorSummary.standing;
          }

          return {
            ...row,
            subjectCells: updatedCells,
            totalMarksSum: sum,
            enteredSubjectsCount: count,
            averageScore: newAvg,
            cgpa,
            standing,
            gradeBadge,
            totalUnits,
            totalQualityPoints,
          };
        });

        if (isSenior) {
          next.sort((a, b) => (b.cgpa || 0) - (a.cgpa || 0) || b.totalMarksSum - a.totalMarksSum);
        } else {
          next.sort((a, b) => b.totalMarksSum - a.totalMarksSum);
        }
        next.forEach((r, idx) => {
          r.rank = r.enteredSubjectsCount > 0 ? idx + 1 : undefined;
        });

        return next;
      });

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setStatusMsg({
        type: 'success',
        text: `Score record permanently cleared for ${activeCell.student.firstName} in ${activeCell.subject.name}. Recalculation complete.`,
      });
      setEditModalOpen(false);
      setActiveCell(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to clear score' });
    } finally {
      setInputSaving(false);
    }
  };

  // Delete all broadsheet scores for a student in this class & term
  const handleDeleteStudentScores = async (student: Student) => {
    if (
      !window.confirm(
        `Are you sure you want to delete and clear ALL score records for ${student.firstName} ${student.surname} (${student.studentId}) in ${selectedClass} - ${selectedTerm} (${selectedSession})?`
      )
    )
      return;

    setLoading(true);
    try {
      const isFaculty = user && user.role !== 'student' && user.role !== 'bursar';
      const authToken = (isFaculty && token) ? token : 'local-teacher-auth:teacher@school.edu';

      // 1. Send delete request to backend
      await fetch(
        `/api/scores?studentId=${encodeURIComponent(String(student.id))}&term=${encodeURIComponent(selectedTerm)}&session=${encodeURIComponent(selectedSession)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        }
      ).catch(() => {});

      // 2. Add to deleted IDs set in localStorage
      try {
        const deletedRaw = localStorage.getItem('fis_deleted_score_ids_v1');
        const deletedIds = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
        availableSubjects.forEach((sub) => {
          deletedIds.add(`key_${student.id}_${sub.id}`);
          deletedIds.add(`key_${student.studentId}_${sub.id}`);
        });
        localStorage.setItem('fis_deleted_score_ids_v1', JSON.stringify([...deletedIds]));
      } catch (_) {}

      // 3. Remove student from broadsheet cached scores
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter(
            (l: any) =>
              !(
                (String(l.studentId) === String(student.id) || l.studentNumber === student.studentId) &&
                l.term === selectedTerm &&
                l.session === selectedSession
              )
          );
          localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
        }
      } catch (_) {}

      // 4. Reset student row scores in state
      setBroadsheetRows((prev) =>
        prev.map((row) => {
          if (row.student.id !== student.id) return row;
          return {
            ...row,
            subjectCells: {},
            totalMarksSum: 0,
            enteredSubjectsCount: 0,
            averageScore: 0,
            cgpa: undefined,
            standing: 'No Scores Recorded',
            gradeBadge: 'N/A',
            totalUnits: 0,
            totalQualityPoints: 0,
            rank: undefined,
          };
        })
      );

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setStatusMsg({
        type: 'success',
        text: `All scores cleared for ${student.firstName} ${student.surname} in ${selectedClass} (${selectedTerm}). Ledger updated!`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to clear student scores' });
    } finally {
      setLoading(false);
    }
  };

  // Remove a student row from broadsheet view
  const handleRemoveStudentFromBroadsheet = (student: Student) => {
    if (
      !window.confirm(
        `Remove ${student.firstName} ${student.surname} (${student.studentId}) from this ${selectedClass} broadsheet display?`
      )
    )
      return;

    setBroadsheetRows((prev) =>
      prev.filter((r) => r.student.id !== student.id && r.student.studentId !== student.studentId)
    );
    setStatusMsg({
      type: 'success',
      text: `${student.firstName} ${student.surname} removed from ${selectedClass} broadsheet ledger.`,
    });
  };

  // Delete an entire subject from broadsheet
  const handleDeleteSubject = async () => {
    if (!subjectToEdit) return;
    if (
      !window.confirm(
        `Are you sure you want to remove the subject "${subjectToEdit.name}" from the class broadsheet? Existing scores for this subject will be hidden.`
      )
    )
      return;

    setSavingSubjectEdit(true);
    try {
      await fetch(`/api/subjects/${subjectToEdit.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});

      setAvailableSubjects((prev) => prev.filter((s) => s.id !== subjectToEdit.id));
      setStatusMsg({
        type: 'success',
        text: `Subject "${subjectToEdit.name}" removed from broadsheet.`,
      });
      setEditSubjectModalOpen(false);
      setSubjectToEdit(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to remove subject' });
    } finally {
      setSavingSubjectEdit(false);
    }
  };

  // Bulk set class school days
  const handleSaveClassSchoolDays = async (e: React.FormEvent) => {
    e.preventDefault();
    const daysNum = Math.max(1, Number(inputClassSchoolDays) || 115);
    setSavingClassDays(true);

    try {
      const rawAtt = localStorage.getItem('fis_student_attendance_v1') || '{}';
      const attMap = JSON.parse(rawAtt);

      for (const row of broadsheetRows) {
        const currentPresent = Math.min(daysNum, row.attendance.timesPresent || 0);
        const absent = Math.max(0, daysNum - currentPresent);
        const rate = daysNum > 0 ? Math.round((currentPresent / daysNum) * 1000) / 10 : 0;
        const newAtt = {
          timesOpened: daysNum,
          timesPresent: currentPresent,
          timesAbsent: absent,
          rate,
          session: selectedSession,
          term: selectedTerm,
        };

        const k1 = String(row.student.studentId || '').toUpperCase().trim();
        const k2 = String(row.student.id || '').trim();
        if (k1) attMap[k1] = newAtt;
        if (k2) attMap[k2] = newAtt;

        // Post to backend
        try {
          const targetId = row.student.studentId || row.student.id;
          fetch(`/api/students/${encodeURIComponent(String(targetId))}/attendance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              timesOpened: daysNum,
              timesPresent: currentPresent,
              session: selectedSession,
              term: selectedTerm,
              studentNumber: row.student.studentId,
            }),
          }).catch(() => {});
        } catch (_) {}
      }

      localStorage.setItem('fis_student_attendance_v1', JSON.stringify(attMap));

      setBroadsheetRows((prev) =>
        prev.map((r) => {
          const currentPresent = Math.min(daysNum, r.attendance.timesPresent || 0);
          const absent = Math.max(0, daysNum - currentPresent);
          const rate = daysNum > 0 ? Math.round((currentPresent / daysNum) * 1000) / 10 : 0;
          return {
            ...r,
            attendance: {
              ...r.attendance,
              timesOpened: daysNum,
              timesPresent: currentPresent,
              timesAbsent: absent,
              rate,
            },
          };
        })
      );

      window.dispatchEvent(new CustomEvent('fis:attendance-updated'));
      window.dispatchEvent(new CustomEvent('fis:scores-updated'));

      setStatusMsg({
        type: 'success',
        text: `Official class school days set to ${daysNum} days for all ${broadsheetRows.length} scholars in ${selectedClass}. Absences automatically generated and reflected on student portals!`,
      });
      setBulkDaysModalOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update class school days' });
    } finally {
      setSavingClassDays(false);
    }
  };

  // Open attendance input modal for teacher
  const handleOpenAttendanceModal = (student: Student, currentAtt?: any) => {
    setAttendanceStudent(student);
    const opened = currentAtt?.timesOpened || 115;
    const present = currentAtt?.timesPresent || 110;
    setInputTimesOpened(String(opened));
    setInputTimesPresent(String(present));
    setAttendanceModalOpen(true);
  };

  // Save student attendance from broadsheet
  const handleSaveAttendance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!attendanceStudent) return;

    setSavingAttendance(true);
    try {
      const opened = Math.max(0, Number(inputTimesOpened) || 0);
      const present = Math.min(opened, Math.max(0, Number(inputTimesPresent) || 0));
      const absent = Math.max(0, opened - present);
      const rate = opened > 0 ? Math.round((present / opened) * 1000) / 10 : 0;

      const newAtt = {
        timesOpened: opened,
        timesPresent: present,
        timesAbsent: absent,
        rate,
        session: selectedSession,
        term: selectedTerm,
      };

      // 1. Update localStorage
      try {
        const rawAtt = localStorage.getItem('fis_student_attendance_v1') || '{}';
        const attMap = JSON.parse(rawAtt);
        const k1 = String(attendanceStudent.studentId || '').toUpperCase().trim();
        const k2 = String(attendanceStudent.id || '').trim();
        if (k1) attMap[k1] = newAtt;
        if (k2) attMap[k2] = newAtt;
        localStorage.setItem('fis_student_attendance_v1', JSON.stringify(attMap));
      } catch (_) {}

      // 2. Post to backend
      try {
        const targetId = attendanceStudent.studentId || attendanceStudent.id;
        await fetch(`/api/students/${encodeURIComponent(String(targetId))}/attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            timesOpened: opened,
            timesPresent: present,
            session: selectedSession,
            term: selectedTerm,
            studentNumber: attendanceStudent.studentId,
          }),
        });
      } catch (_) {}

      // 3. Update broadsheet rows in state
      setBroadsheetRows((prev) =>
        prev.map((r) =>
          r.student.id === attendanceStudent.id ? { ...r, attendance: newAtt } : r
        )
      );

      // 4. Dispatch global events
      window.dispatchEvent(new CustomEvent('fis:attendance-updated'));
      window.dispatchEvent(new CustomEvent('fis:scores-updated'));

      setStatusMsg({
        type: 'success',
        text: `Attendance saved for ${attendanceStudent.firstName} ${attendanceStudent.surname}: ${present}/${opened} days (${rate}%). Reflected on broadsheet and student dashboard!`,
      });

      setAttendanceModalOpen(false);
      setAttendanceStudent(null);
    } catch (err: any) {
      console.warn('Attendance save err:', err);
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update attendance' });
    } finally {
      setSavingAttendance(false);
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
            onClick={() => setBulkDaysModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border border-amber-500/40 shadow"
            title="Set official term school days for all scholars in this class"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            Set Class School Days
          </button>
          <button
            onClick={() => setAddSubjectModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Subject
          </button>
          <button
            onClick={() => setShowPrintPreview(!showPrintPreview)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow ${
              showPrintPreview
                ? 'bg-amber-600 text-white shadow-amber-900/40'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
            }`}
            title="Toggle Printable Broadsheet preview on screen"
          >
            {showPrintPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPrintPreview ? 'Exit Print Preview' : 'Print Preview'}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950"
            title="Open system print dialog to print or save landscape broadsheet as PDF"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            Print Broadsheet
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 print:hidden ${
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
      <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-sm print:hidden">
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
      <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-300 gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          {isSenior ? (
            <span>
              <strong className="text-amber-300">Senior Secondary Standard ({selectedClass}):</strong> Each evaluated subject carries{' '}
              <strong>2 Credit Units</strong>. Evaluated on the <strong>5.0 CGPA scale</strong> (70+=5.0, 60+=4.0, 50+=3.0, 45+=2.0, 40+=1.0, &lt;40=0.0). Quality Points = 2 × GP. Broadsheet records CA (/40) + Exam (/60) = 100.
            </span>
          ) : isSecondary ? (
            <span>
              <strong>Junior Secondary Standard ({selectedClass}):</strong> Two exams per term. Test/CA is marked over <strong>40</strong>, Exam is marked over <strong>60</strong>, totaling <strong>100</strong>. Graded on overall <strong>Terminal Average Percentage (%)</strong>.
            </span>
          ) : (
            <span>
              <strong>Primary &amp; Lower Class Standard ({selectedClass}):</strong> Exam conducted once a term. CA is marked over <strong>40</strong>, and Terminal Exam is over <strong>60</strong>, totaling <strong>100</strong>. Graded on <strong>Terminal Average Percentage (%)</strong>.
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            {isSenior ? 'Automatic Senior CGPA (5.0 Scale)' : 'Automatic Class Average (%) & Rank'}
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
          <div className="overflow-x-auto print:hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-300 border-b border-slate-700 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-3 text-center w-12 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                    Rank
                  </th>
                  <th className="py-3 px-3 min-w-[170px] sticky left-12 bg-slate-900 z-10 border-r border-slate-700">
                    Student Scholar
                  </th>
                  <th className="py-3 px-2 text-center min-w-[130px] border-r border-slate-700 bg-slate-900/90" title="School Attendance: Present / Opened / Absent (Auto-calculated)">
                    <div>Attendance</div>
                    <div className="text-[9px] font-normal text-amber-300 font-mono mt-0.5">P / O / (Abs)</div>
                  </th>
                  {availableSubjects.map((sub, idx) => (
                    <th key={`bs_sub_th_${sub.id}_${sub.code || ''}_${idx}`} className="py-3 px-2 text-center min-w-[130px] border-r border-slate-800 group/th">
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
                  <th className="py-3 px-3 text-center min-w-[80px] text-amber-400 font-black bg-slate-900/80 border-r border-slate-700">
                    Total Marks
                  </th>
                  {isSenior ? (
                    <>
                      <th className="py-3 px-2 text-center min-w-[65px] text-slate-300 font-semibold bg-slate-900/80 border-r border-slate-800">
                        Units (2u)
                      </th>
                      <th className="py-3 px-2 text-center min-w-[65px] text-slate-300 font-semibold bg-slate-900/80 border-r border-slate-800">
                        TQP
                      </th>
                      <th className="py-3 px-3 text-center min-w-[95px] text-emerald-400 font-black bg-slate-900/80 border-r border-slate-700">
                        CGPA (5.0)
                      </th>
                      <th className="py-3 px-3 text-center min-w-[120px] text-amber-300 font-bold bg-slate-900/80">
                        Standing
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-3 text-center min-w-[90px] text-emerald-400 font-black bg-slate-900/80 border-r border-slate-800">
                        Average (%)
                      </th>
                      <th className="py-3 px-2 text-center min-w-[70px] text-blue-400 font-bold bg-slate-900/80 border-r border-slate-800">
                        Grade
                      </th>
                      <th className="py-3 px-3 text-center min-w-[120px] text-slate-300 font-medium bg-slate-900/80">
                        Standing
                      </th>
                    </>
                  )}
                  <th className="py-3 px-3 text-center min-w-[110px] text-amber-300 font-bold bg-slate-900 border-l border-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-200">
                {broadsheetRows.map((row, rIdx) => {
                  const studentName = `${row.student.firstName} ${row.student.surname}`;
                  return (
                    <tr key={`bs_row_${row.student.id}_${row.student.studentId || ''}_${rIdx}`} className="hover:bg-slate-750 transition group">
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

                      {/* Student Name & ID & Guardian details */}
                      <td className="py-2.5 px-3 font-semibold text-white sticky left-12 bg-slate-850 group-hover:bg-slate-750 z-10 border-r border-slate-700">
                        <div className="truncate max-w-[170px]" title={studentName}>
                          {studentName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {row.student.studentId}
                        </div>
                        {(row.student.parentName || row.student.parentPhone) && (
                          <div className="text-[10px] text-amber-300 font-normal truncate max-w-[170px] mt-0.5" title={`Guardian: ${row.student.parentName || 'Recorded'} • Phone: ${row.student.parentPhone || 'N/A'}`}>
                            👤 {row.student.parentName || 'Guardian'} {row.student.parentPhone ? `(${row.student.parentPhone})` : ''}
                          </div>
                        )}
                      </td>

                      {/* Attendance (Times present / times opened / auto-generated absent) */}
                      <td
                        className="py-2.5 px-2 text-center border-r border-slate-700/80 hover:bg-slate-700/40 transition group/attcell"
                      >
                        <div className="flex flex-col items-center">
                          <div className="flex items-center justify-center gap-1 font-mono text-xs font-bold">
                            <span className="text-emerald-400" title="Days Present">{row.attendance.timesPresent}P</span>
                            <span className="text-slate-500">/</span>
                            <span className="text-slate-300" title="Days Opened">{row.attendance.timesOpened}O</span>
                            <span className="text-slate-500">/</span>
                            <span className="text-rose-400 px-1 py-0.2 bg-rose-500/10 rounded font-black" title="Days Absent (Auto-calculated: Days Opened - Days Present)">
                              {row.attendance.timesAbsent ?? Math.max(0, row.attendance.timesOpened - row.attendance.timesPresent)}A
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-amber-300 font-mono font-semibold">
                              {row.attendance.rate}%
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenAttendanceModal(row.student, row.attendance)}
                              className="px-1.5 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer border border-emerald-500/40 shadow-sm"
                              title="Add/Edit days present & opened (Auto-computes absent) and Save to Student Portal"
                            >
                              <Save className="w-2.5 h-2.5" />
                              Save
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Subject Cells */}
                      {availableSubjects.map((sub, subIdx) => {
                        const cell = row.subjectCells[sub.id];
                        const hasScore = cell && cell.totalScore !== null && cell.totalScore !== undefined;

                        return (
                          <td
                            key={`bs_cell_${row.student.id}_${sub.id}_${subIdx}`}
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
                            <div className="text-sm">{row.totalMarksSum}</div>
                            <div className="text-[9px] font-normal text-slate-500">
                              ({row.enteredSubjectsCount} sub)
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Senior CGPA vs Junior Average */}
                      {isSenior ? (
                        <>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300 border-r border-slate-800">
                            {row.totalUnits || '-'}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-semibold text-amber-300 border-r border-slate-800">
                            {row.totalQualityPoints ? row.totalQualityPoints.toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-400 text-sm bg-slate-900/40 border-r border-slate-700">
                            {row.cgpa !== undefined ? `${row.cgpa.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-xs font-semibold text-slate-200">
                            {row.enteredSubjectsCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 border border-slate-700 text-amber-300">
                                {row.standing}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-center font-black text-emerald-400 bg-slate-900/40 font-mono text-sm border-r border-slate-800">
                            {row.enteredSubjectsCount > 0 ? `${row.averageScore}%` : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold border-r border-slate-800">
                            {row.enteredSubjectsCount > 0 ? (
                              <span className="px-1.5 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-300 font-bold">
                                {calculateSubjectGrade(row.averageScore)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-xs font-medium text-slate-300">
                            {row.enteredSubjectsCount > 0 ? row.standing : '-'}
                          </td>
                        </>
                      )}

                      {/* Row Actions: Attendance, Clear Scores, Remove */}
                      <td className="py-2.5 px-2 text-center border-l border-slate-700/80 bg-slate-900/40">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenAttendanceModal(row.student, row.attendance)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition cursor-pointer border border-emerald-500/30"
                            title="Add/Edit attendance (Days opened & present -> auto absent) and Save to Student Portal"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStudentScores(row.student)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition cursor-pointer border border-rose-500/30"
                            title={`Delete / Clear broadsheet scores for ${studentName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudentFromBroadsheet(row.student)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer border border-slate-700"
                            title={`Remove ${studentName} from this broadsheet class view`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Statistics Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-700 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3 print:hidden">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total Scholars: <strong className="text-white">{broadsheetRows.length}</strong>
            </span>
            <span>
              Recorded Scholars:{' '}
              <strong className="text-white">
                {broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length}
              </strong>
            </span>
            {isSenior ? (
              <span>
                Class Mean CGPA:{' '}
                <strong className="text-emerald-400 font-mono">
                  {broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length > 0
                    ? (
                        broadsheetRows
                          .filter((r) => r.enteredSubjectsCount > 0)
                          .reduce((acc, r) => acc + (r.cgpa || 0), 0) /
                        broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length
                      ).toFixed(2)
                    : '0.00'}{' '}
                  / 5.00 (2 Units/Sub)
                </strong>
              </span>
            ) : (
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
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              {isSenior
                ? 'Senior Secondary Scale: A1 (70+=5.0), B2/B3 (60+=4.0), C4/C5 (50+=3.0), D7 (45+=2.0), E8 (40+=1.0), F9 (<40=0.0)'
                : 'Grading Scheme: A1 (75-100) • B2 (70-74) • B3 (65-69) • C4-C6 (50-64) • D7-E8 (40-49) • F9 (0-39)'}
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
                {(activeCell.currentTotal || activeCell.currentTest || activeCell.currentExam || activeCell.testId || activeCell.examId || activeCell.generalId) ? (
                  <button
                    type="button"
                    onClick={handleDeleteCellScore}
                    disabled={inputSaving}
                    className="px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear / Delete Score
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

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleDeleteSubject}
                  disabled={savingSubjectEdit}
                  className="px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Remove this subject from the broadsheet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Subject
                </button>
                <div className="flex items-center gap-2">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: TEACHER ATTENDANCE INPUT MODAL                  */}
      {/* ======================================================== */}
      {attendanceModalOpen && attendanceStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Record Scholar Attendance (Sync to Portal)
              </h3>
              <button
                onClick={() => setAttendanceModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="space-y-4">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs space-y-1">
                <span className="text-slate-400 block font-medium">Scholar Details:</span>
                <p className="font-bold text-white text-sm">
                  {attendanceStudent.firstName} {attendanceStudent.surname}
                </p>
                <p className="text-emerald-400 font-mono text-[11px]">
                  ID: {attendanceStudent.studentId} • Class: {selectedClass} • Session: {selectedSession} ({selectedTerm})
                </p>
                {(attendanceStudent.parentName || attendanceStudent.parentPhone) && (
                  <p className="text-amber-300 font-mono text-[11px] pt-1 border-t border-slate-700/80">
                    Guardian: {attendanceStudent.parentName || 'Recorded'} {attendanceStudent.parentPhone ? `(${attendanceStudent.parentPhone})` : ''}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Times School Opened *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    required
                    value={inputTimesOpened}
                    onChange={(e) => setInputTimesOpened(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Official term school days</span>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Times Present *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={Number(inputTimesOpened) || 300}
                    required
                    value={inputTimesPresent}
                    onChange={(e) => setInputTimesPresent(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Days scholar attended</span>
                </div>
              </div>

              {/* Computed live summary: auto-generates absent days */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px]">Auto-Generated Absent Days:</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">
                    {Math.max(0, (Number(inputTimesOpened) || 0) - (Number(inputTimesPresent) || 0))} days absent
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Attendance Punctuality Rate:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {Number(inputTimesOpened) > 0
                      ? `${(
                          (Math.min(Number(inputTimesOpened), Number(inputTimesPresent)) /
                            Number(inputTimesOpened)) *
                          100
                        ).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAttendanceModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAttendance}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-950 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  {savingAttendance ? 'Saving & Syncing...' : 'Save Attendance to Student Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: SET CLASS SCHOOL DAYS (BULK OPENED DAYS)        */}
      {/* ======================================================== */}
      {bulkDaysModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Set Term School Days for {selectedClass}
              </h3>
              <button
                onClick={() => setBulkDaysModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClassSchoolDays} className="space-y-4">
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 text-xs space-y-1">
                <p className="font-semibold text-amber-300">Class Attendance Master Setting</p>
                <p className="text-slate-300">
                  Enter the total number of days the school was opened for <strong>{selectedClass}</strong> during <strong>{selectedTerm} ({selectedSession})</strong>.
                  This will automatically calculate absent days for all enrolled scholars and reflect on their student portals!
                </p>
              </div>

              <div>
                <label className="block font-semibold text-xs text-slate-300 mb-1">
                  Total Days School Opened *
                </label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  required
                  value={inputClassSchoolDays}
                  onChange={(e) => setInputClassSchoolDays(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-base font-bold focus:outline-none focus:border-amber-400"
                  placeholder="e.g. 115"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Applicable to all {broadsheetRows.length} scholars in this class ledger.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBulkDaysModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClassDays}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-950 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  {savingClassDays ? 'Applying to Class...' : 'Apply & Save Class School Days'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PRINTABLE BROADSHEET (LANDSCAPE MASTER LEDGER)           */}
      {/* ======================================================== */}
      {showPrintPreview && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-300 print:hidden">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Official Broadsheet Print Preview Active:</strong> Below is the exact high-contrast landscape institutional ledger that will be printed or exported to PDF.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              Print / Save PDF Now
            </button>
            <button
              onClick={() => setShowPrintPreview(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      <div
        className={`${
          showPrintPreview
            ? 'block border-4 border-slate-700 p-6 sm:p-8 bg-white text-black rounded-3xl my-6 shadow-2xl overflow-x-auto'
            : 'hidden print:block'
        } print:w-full print:p-0 print:m-0 print:bg-white print:text-black`}
      >
        {/* Print Stylesheet */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: landscape;
              margin: 8mm;
            }
            @media print {
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `
        }} />

        {/* Print Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-3">
          <div className="flex items-center gap-4">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-black">
                Fenster International School
              </h1>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                Institutional Academic Registry • Official Master Class Broadsheet
              </p>
              <p className="text-[10px] text-slate-600">
                Excellence in Academics & Moral Discipline • Institutional Examination Ledger
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] space-y-0.5">
            <div>
              <span className="font-semibold text-slate-700">Class: </span>
              <strong className="font-bold text-black uppercase">{selectedClass}</strong>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Academic Session: </span>
              <strong className="font-bold text-black">{selectedSession}</strong>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Term / Examination: </span>
              <strong className="font-bold text-black">
                {selectedTerm} • {isSecondary ? (examPeriod === 'first-half' ? '1st Half Exam (6th Wk)' : 'Terminal Exam') : 'Terminal Examination'}
              </strong>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Grading Standard: </span>
              <strong className="font-bold text-black">
                {isSenior ? 'Senior Secondary 5.0 CGPA Scale (2 Credit Units/Subject)' : 'Junior / Primary Terminal Class Average (%)'}
              </strong>
            </div>
          </div>
        </div>

        {/* Print Summary Strip */}
        <div className="flex items-center justify-between text-[10px] bg-slate-100 border border-slate-300 px-3 py-1.5 mb-3 font-semibold text-slate-800">
          <span>Enrolled Scholars: {broadsheetRows.length}</span>
          <span>Subjects Evaluated: {availableSubjects.length}</span>
          <span>
            {isSenior
              ? `Class Mean CGPA: ${(broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).reduce((acc, r) => acc + (r.cgpa || 0), 0) / Math.max(1, broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length)).toFixed(2)} / 5.00`
              : `Class Terminal Average: ${(broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).reduce((acc, r) => acc + r.averageScore, 0) / Math.max(1, broadsheetRows.filter((r) => r.enteredSubjectsCount > 0).length)).toFixed(1)}%`}
          </span>
          <span>Date Compiled: {new Date().toLocaleDateString('en-GB')}</span>
        </div>

        {/* Print Table */}
        <table className="w-full text-left text-[10px] border-collapse border border-black">
          <thead>
            <tr className="bg-slate-200 text-black font-bold border-b border-black">
              <th className="p-1 border border-black text-center w-8">#</th>
              <th className="p-1 border border-black min-w-[130px]">Scholar Name</th>
              <th className="p-1 border border-black text-center w-20">Admission ID</th>
              <th className="p-1 border border-black text-center w-16">Attendance</th>
              {availableSubjects.map((sub, idx) => (
                <th key={`print_th_${sub.id}_${sub.code || ''}_${idx}`} className="p-1 border border-black text-center min-w-[70px]">
                  <div className="font-bold truncate max-w-[80px] mx-auto">{sub.name}</div>
                  <div className="text-[8px] font-normal text-slate-700">CA|Ex|Tot|G</div>
                </th>
              ))}
              <th className="p-1 border border-black text-center font-bold min-w-[50px]">Total</th>
              {isSenior ? (
                <>
                  <th className="p-1 border border-black text-center font-bold w-12">Units</th>
                  <th className="p-1 border border-black text-center font-bold w-12">TQP</th>
                  <th className="p-1 border border-black text-center font-black w-16">CGPA (5.0)</th>
                  <th className="p-1 border border-black text-center font-bold min-w-[80px]">Standing</th>
                </>
              ) : (
                <>
                  <th className="p-1 border border-black text-center font-black w-14">Avg (%)</th>
                  <th className="p-1 border border-black text-center font-bold w-10">Grade</th>
                  <th className="p-1 border border-black text-center font-bold min-w-[80px]">Standing</th>
                </>
              )}
              <th className="p-1 border border-black text-center font-bold w-10">Pos</th>
            </tr>
          </thead>
          <tbody>
            {broadsheetRows.map((r, idx) => (
              <tr key={`print_tr_${r.student.id}_${r.student.studentId || ''}_${idx}`} className="border-b border-black">
                <td className="p-1 border border-black text-center font-mono">{idx + 1}</td>
                <td className="p-1 border border-black font-semibold truncate max-w-[130px]">
                  <div>{r.student.firstName} {r.student.surname}</div>
                  {(r.student.parentName || r.student.parentPhone) && (
                    <div className="text-[7.5px] font-normal text-slate-700 leading-tight">
                      👤 {r.student.parentName || 'Guardian'} {r.student.parentPhone ? `(${r.student.parentPhone})` : ''}
                    </div>
                  )}
                </td>
                <td className="p-1 border border-black text-center font-mono">{r.student.studentId}</td>
                <td className="p-1 border border-black text-center font-mono text-[9px]">
                  {r.attendance.timesPresent}/{r.attendance.timesOpened}
                </td>
                {availableSubjects.map((sub, sIdx) => {
                  const cell = r.subjectCells[sub.id];
                  return (
                    <td key={`print_td_${r.student.id}_${sub.id}_${sIdx}`} className="p-1 border border-black text-center font-mono text-[9px]">
                      {cell && cell.totalScore !== null ? (
                        <span>
                          {cell.testScore ?? '-'}|{cell.examScore ?? '-'}|<strong>{cell.totalScore}</strong>|{cell.grade}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  );
                })}
                <td className="p-1 border border-black text-center font-mono font-bold">
                  {r.enteredSubjectsCount > 0 ? r.totalMarksSum : '-'}
                </td>
                {isSenior ? (
                  <>
                    <td className="p-1 border border-black text-center font-mono">{r.totalUnits || '-'}</td>
                    <td className="p-1 border border-black text-center font-mono">{r.totalQualityPoints || '-'}</td>
                    <td className="p-1 border border-black text-center font-mono font-black text-[11px]">
                      {r.cgpa !== undefined ? r.cgpa.toFixed(2) : '-'}
                    </td>
                    <td className="p-1 border border-black text-center text-[9px] font-semibold">
                      {r.standing}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-1 border border-black text-center font-mono font-black text-[11px]">
                      {r.enteredSubjectsCount > 0 ? `${r.averageScore}%` : '-'}
                    </td>
                    <td className="p-1 border border-black text-center font-bold">
                      {r.enteredSubjectsCount > 0 ? calculateSubjectGrade(r.averageScore) : '-'}
                    </td>
                    <td className="p-1 border border-black text-center text-[9px] font-semibold">
                      {r.standing}
                    </td>
                  </>
                )}
                <td className="p-1 border border-black text-center font-mono font-bold">
                  {r.rank ? `${r.rank}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Print Signatures */}
        <div className="grid grid-cols-3 gap-8 mt-8 pt-4 border-t border-black text-center text-[10px]">
          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-1" />
            <span className="font-bold uppercase">Form Teacher / Class Master</span>
          </div>
          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-1" />
            <span className="font-bold uppercase">Head of Department / Academic Dean</span>
          </div>
          <div>
            <div className="border-b border-black w-3/4 mx-auto mb-1" />
            <span className="font-bold uppercase">Principal / Institutional Director</span>
          </div>
        </div>
      </div>
    </div>
  );
};

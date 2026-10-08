import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  FileSpreadsheet,
  Search,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Calendar,
  Save,
  Check,
  UserCheck,
  Users,
  Edit2,
  Trash2,
  X,
  Plus,
  RefreshCw,
  Clock,
  Layers,
  Award,
} from 'lucide-react';
import { Subject, Student } from '../types/index.ts';
import { fetchAllSubjectsUnified } from '../lib/subjectStore.ts';
import { fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import { isSecondaryClass, calculateSubjectGrade } from '../constants/classes.ts';

interface AddScoreModalProps {
  preselectedStudent?: Student | null;
  onScoreSaved?: () => void;
  onClose?: () => void;
}

export const AddScoreModal: React.FC<AddScoreModalProps> = ({
  preselectedStudent,
  onScoreSaved,
  onClose,
}) => {
  const { token, user } = useAuth();
  const authToken =
    token ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sqams_token') : null) ||
    'local-teacher-auth:teacher@school.edu';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  // Student Lookup
  const [selectedStudentDropdownId, setSelectedStudentDropdownId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState(preselectedStudent?.studentId || '');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(preselectedStudent || null);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Score Entry Configuration
  const [session, setSession] = useState('2026/2027');
  const [term, setTerm] = useState('First Term');
  const [examPeriod, setExamPeriod] = useState<'first-half' | 'terminal'>('terminal');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | string>('');

  // Dual score components (CA out of 40, Exam out of 60)
  const [caScore, setCaScore] = useState<string>('');
  const [examScore, setExamScore] = useState<string>('');
  const [teacherComment, setTeacherComment] = useState('Very good academic performance.');

  // Existing Scores for the Matched Student
  const [existingScores, setExistingScores] = useState<any[]>([]);
  const [loadingExistingScores, setLoadingExistingScores] = useState(false);

  // Score Editing Modal State
  const [editingScoreItem, setEditingScoreItem] = useState<any | null>(null);
  const [editScoreCa, setEditScoreCa] = useState<string>('');
  const [editScoreExam, setEditScoreExam] = useState<string>('');
  const [editScoreComment, setEditScoreComment] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Submission status
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isSecondary = matchedStudent ? isSecondaryClass(matchedStudent.currentClass) : true;

  // Load unified subjects & roster
  useEffect(() => {
    fetchAllSubjectsUnified(authToken).then((subs) => {
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subs[0].id);
      }
    });

    fetchAllStudentsUnified(authToken).then((students) => {
      setAllStudents(students);
      if (preselectedStudent) {
        const found = students.find(
          (s) => s.id === preselectedStudent.id || s.studentId === preselectedStudent.studentId
        );
        if (found) {
          setMatchedStudent(found);
          setSelectedStudentDropdownId(String(found.id));
        }
      }
    });
  }, [authToken]);

  // Sync preselected student
  useEffect(() => {
    if (preselectedStudent) {
      setMatchedStudent(preselectedStudent);
      setStudentSearchQuery(preselectedStudent.studentId);
      setSelectedStudentDropdownId(String(preselectedStudent.id));
    }
  }, [preselectedStudent]);

  // When matched student or term changes, load their existing scores
  useEffect(() => {
    if (matchedStudent) {
      loadStudentScores(matchedStudent);
    } else {
      setExistingScores([]);
    }
  }, [matchedStudent, term, session]);

  const loadStudentScores = async (st: Student) => {
    setLoadingExistingScores(true);
    try {
      const res = await fetch(
        `/api/scores?student=${encodeURIComponent(st.studentId || String(st.id))}&session=${encodeURIComponent(
          session
        )}&term=${encodeURIComponent(term)}`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (res.ok) {
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch (_) {}
        setExistingScores(data.scores || data.results || []);
      }
    } catch (err) {
      console.warn('Failed to fetch existing student scores:', err);
    } finally {
      setLoadingExistingScores(false);
    }
  };

  const handleDropdownSelect = (idStr: string) => {
    setSelectedStudentDropdownId(idStr);
    setSearchError(null);
    setSaveSuccess(null);
    if (!idStr) {
      setMatchedStudent(null);
      return;
    }
    const target = allStudents.find((s) => String(s.id) === idStr || s.studentId === idStr);
    if (target) {
      setMatchedStudent(target);
      setStudentSearchQuery(target.studentId);
    }
  };

  const handleLookupStudent = async () => {
    if (!studentSearchQuery.trim()) return;
    setSearchingStudent(true);
    setSearchError(null);
    setSaveSuccess(null);

    const cleanQ = studentSearchQuery.trim().toLowerCase();
    const directMatch = allStudents.find(
      (s) =>
        s.studentId.toLowerCase() === cleanQ ||
        `${s.firstName} ${s.surname}`.toLowerCase().includes(cleanQ) ||
        s.surname.toLowerCase().includes(cleanQ) ||
        (s.currentClass && s.currentClass.toLowerCase().includes(cleanQ))
    );

    if (directMatch) {
      setMatchedStudent(directMatch);
      setSelectedStudentDropdownId(String(directMatch.id));
      setSearchingStudent(false);
      return;
    }

    try {
      const res = await fetch(`/api/students?q=${encodeURIComponent(studentSearchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch (_) {}
      if (data && Array.isArray(data.students) && data.students.length > 0) {
        setMatchedStudent(data.students[0]);
        setSelectedStudentDropdownId(String(data.students[0].id));
      } else {
        // Fallback to local roster
        const local = allStudents.find(
          (s) =>
            s.studentId.toLowerCase().includes(cleanQ) ||
            `${s.firstName} ${s.surname}`.toLowerCase().includes(cleanQ) ||
            s.surname.toLowerCase().includes(cleanQ) ||
            (s.currentClass && s.currentClass.toLowerCase().includes(cleanQ))
        );
        if (local) {
          setMatchedStudent(local);
          setSelectedStudentDropdownId(String(local.id));
        } else {
          setMatchedStudent(null);
          setSearchError(`No student found matching "${studentSearchQuery}"`);
        }
      }
    } catch (e: any) {
      // Offline / fallback lookup
      const local = allStudents.find(
        (s) =>
          s.studentId.toLowerCase().includes(cleanQ) ||
          `${s.firstName} ${s.surname}`.toLowerCase().includes(cleanQ) ||
          s.surname.toLowerCase().includes(cleanQ) ||
          (s.currentClass && s.currentClass.toLowerCase().includes(cleanQ))
      );
      if (local) {
        setMatchedStudent(local);
        setSelectedStudentDropdownId(String(local.id));
      } else {
        setSearchError(e.message || 'Lookup failed');
      }
    } finally {
      setSearchingStudent(false);
    }
  };

  // Live Score Math
  const numCa = caScore === '' ? null : Math.min(40, Math.max(0, parseFloat(caScore) || 0));
  const numExam = examScore === '' ? null : Math.min(60, Math.max(0, parseFloat(examScore) || 0));

  let liveTotal: number | null = null;
  if (numCa !== null || numExam !== null) {
    liveTotal = (numCa || 0) + (numExam || 0);
  }

  const livePercentage = liveTotal !== null ? liveTotal : null;
  const liveGrade = liveTotal !== null ? calculateSubjectGrade(liveTotal) : '-';

  const selectedSubjectObj = subjects.find((s) => String(s.id) === String(selectedSubjectId));

  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedStudent) {
      setSaveError('Please select and verify a student first.');
      return;
    }

    if (numCa === null && numExam === null) {
      setSaveError('Please enter at least one score (Continuous Assessment over 40 or Examination over 60).');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const effectivePeriod = examPeriod;
    const periodLabel = effectivePeriod === 'first-half' ? 'First Half Term' : 'Terminal Term';
    const subName = selectedSubjectObj?.name || 'Selected Subject';
    const subCode = selectedSubjectObj?.code || 'GEN';

    try {
      // 1. If CA score was entered, save CA record (maxScore: 40)
      if (numCa !== null) {
        const caTitle = `${periodLabel} Continuous Assessment Test`;
        const comment = JSON.stringify({
          caScore: numCa,
          examScore: numExam,
          totalScore: liveTotal,
          examPeriod: effectivePeriod,
          userNote: teacherComment,
        });

        const caRes = await fetch('/api/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            studentId: matchedStudent.id,
            studentNumber: matchedStudent.studentId,
            firstName: matchedStudent.firstName,
            surname: matchedStudent.surname,
            currentClass: matchedStudent.currentClass,
            gender: matchedStudent.gender || 'Female',
            subjectId: selectedSubjectId,
            subjectName: subName,
            subjectCode: subCode,
            assessmentType: 'CA',
            assessmentTitle: caTitle,
            score: numCa,
            maxScore: 40,
            session,
            term,
            teacherComment: comment,
          }),
        });

        if (!caRes.ok) {
          const caText = await caRes.text();
          let errObj: any = {};
          try { errObj = JSON.parse(caText); } catch (_) {}
          const errorMsg =
            errObj.error ||
            errObj.message ||
            (caText.length < 200 && !caText.includes('<') ? caText : '') ||
            `Failed to record CA score (Status ${caRes.status})`;
          throw new Error(errorMsg);
        }
      }

      // 2. If Exam score was entered, save Main Exam record (maxScore: 60)
      if (numExam !== null) {
        const examTitle = `${periodLabel} Main Examination`;
        const comment = JSON.stringify({
          caScore: numCa,
          examScore: numExam,
          totalScore: liveTotal,
          examPeriod: effectivePeriod,
          userNote: teacherComment,
        });

        const examRes = await fetch('/api/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            studentId: matchedStudent.id,
            studentNumber: matchedStudent.studentId,
            firstName: matchedStudent.firstName,
            surname: matchedStudent.surname,
            currentClass: matchedStudent.currentClass,
            gender: matchedStudent.gender || 'Female',
            subjectId: selectedSubjectId,
            subjectName: subName,
            subjectCode: subCode,
            assessmentType: 'Examination',
            assessmentTitle: examTitle,
            score: numExam,
            maxScore: 60,
            session,
            term,
            teacherComment: comment,
          }),
        });

        if (!examRes.ok) {
          const examText = await examRes.text();
          let errObj: any = {};
          try { errObj = JSON.parse(examText); } catch (_) {}
          const errorMsg =
            errObj.error ||
            errObj.message ||
            (examText.length < 200 && !examText.includes('<') ? examText : '') ||
            `Failed to record Main Examination score (Status ${examRes.status})`;
          throw new Error(errorMsg);
        }
      }

      // 3. Immediately sync to local broadsheet cache so it appears on Broadsheet in real time
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        const list = cached ? JSON.parse(cached) : [];
        const filtered = list.filter(
          (l: any) =>
            !(
              (l.studentId === matchedStudent.id || l.studentNumber === matchedStudent.studentId) &&
              Number(l.subjectId) === Number(selectedSubjectId) &&
              l.term === term &&
              l.session === session &&
              l.examPeriod === effectivePeriod
            )
        );

        filtered.push({
          studentId: matchedStudent.id,
          studentNumber: matchedStudent.studentId,
          subjectId: Number(selectedSubjectId),
          subjectName: subName,
          testScore: numCa,
          examScore: numExam,
          totalScore: liveTotal,
          term,
          session,
          examPeriod: effectivePeriod,
        });

        localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
      } catch (_) {}

      // 4. Trigger global score update events so broadsheet & student profile live-reload
      window.dispatchEvent(
        new CustomEvent('fis:scores-updated', {
          detail: {
            studentId: matchedStudent.id,
            studentNumber: matchedStudent.studentId,
            subjectId: selectedSubjectId,
            term,
            session,
          },
        })
      );
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setSaveSuccess(
        `✓ Successfully saved scores for ${subName}: CA ${numCa ?? 0}/40 + Exam ${numExam ?? 0}/60 = Total ${liveTotal}/100 (Grade ${liveGrade}). Automatically saved to broadsheet and student portal!`
      );

      // Clear score inputs for rapid next entry
      setCaScore('');
      setExamScore('');

      // Refresh existing scores
      await loadStudentScores(matchedStudent);

      onScoreSaved?.();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save assessment score record');
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal for an Existing Score
  const handleOpenEditScore = (item: any) => {
    let parsedCa = '';
    let parsedExam = '';
    let userNote = item.teacherComment || '';

    try {
      if (item.teacherComment && item.teacherComment.trim().startsWith('{')) {
        const obj = JSON.parse(item.teacherComment);
        if (obj.caScore !== undefined) parsedCa = String(obj.caScore);
        if (obj.examScore !== undefined) parsedExam = String(obj.examScore);
        if (obj.userNote !== undefined) userNote = obj.userNote;
      }
    } catch (_) {}

    if (!parsedCa && Number(item.maxScore) === 40) {
      parsedCa = String(item.score);
    } else if (!parsedExam && Number(item.maxScore) === 60) {
      parsedExam = String(item.score);
    } else if (!parsedCa && !parsedExam) {
      parsedExam = String(item.score);
    }

    setEditingScoreItem(item);
    setEditScoreCa(parsedCa);
    setEditScoreExam(parsedExam);
    setEditScoreComment(userNote);
  };

  const handleSaveEditedScore = async () => {
    if (!editingScoreItem) return;
    setSavingEdit(true);

    try {
      const parsedCaNum = editScoreCa === '' ? null : Math.min(40, Math.max(0, parseFloat(editScoreCa) || 0));
      const parsedExamNum = editScoreExam === '' ? null : Math.min(60, Math.max(0, parseFloat(editScoreExam) || 0));

      const isCaItem = Number(editingScoreItem.maxScore) === 40 || editingScoreItem.assessmentType === 'CA';
      const targetScore = isCaItem ? (parsedCaNum ?? Number(editingScoreItem.score)) : (parsedExamNum ?? Number(editingScoreItem.score));

      const updatedPayload = JSON.stringify({
        caScore: parsedCaNum,
        examScore: parsedExamNum,
        totalScore: (parsedCaNum || 0) + (parsedExamNum || 0),
        userNote: editScoreComment,
      });

      const res = await fetch(`/api/scores/${editingScoreItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          score: targetScore,
          maxScore: editingScoreItem.maxScore,
          teacherComment: updatedPayload,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(text); } catch (_) {}
        const errorMsg =
          errData.error ||
          errData.message ||
          (text.length < 200 && !text.includes('<') ? text : '') ||
          `Failed to update score (Status ${res.status})`;
        throw new Error(errorMsg);
      }

      // Update broadsheet cache as well
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        const list = cached ? JSON.parse(cached) : [];
        const found = list.find(
          (l: any) =>
            (l.studentId === matchedStudent?.id || l.studentNumber === matchedStudent?.studentId) &&
            Number(l.subjectId) === Number(editingScoreItem.subjectId)
        );
        if (found) {
          if (parsedCaNum !== null) found.testScore = parsedCaNum;
          if (parsedExamNum !== null) found.examScore = parsedExamNum;
          found.totalScore = (found.testScore || 0) + (found.examScore || 0);
          localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(list));
        }
      } catch (_) {}

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setEditingScoreItem(null);
      if (matchedStudent) await loadStudentScores(matchedStudent);
    } catch (err: any) {
      alert(err.message || 'Failed to update score');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete an existing score record
  const handleDeleteScore = async (scoreId: number, subjectName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this recorded score for "${subjectName}"?\n\nThis will remove it from the student portal and the class broadsheet.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/scores/${scoreId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) {
        const text = await res.text();
        let errData: any = {};
        try { errData = JSON.parse(text); } catch (_) {}
        const errorMsg =
          errData.error ||
          errData.message ||
          (text.length < 200 && !text.includes('<') ? text : '') ||
          `Failed to delete score (Status ${res.status})`;
        throw new Error(errorMsg);
      }

      // Also clean up local broadsheet cache
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter((l: any) => l.testId !== scoreId && l.examId !== scoreId && l.id !== scoreId);
          localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
        }
      } catch (_) {}

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      if (matchedStudent) await loadStudentScores(matchedStudent);
    } catch (err: any) {
      alert(err.message || 'Failed to delete score record');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl fis-card-accent">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
              <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block">
                Fenster International School • Faculty Assessment Console
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Add & Manage Student Scores
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Input Continuous Assessment (CA max 40) and Main Exam (max 60) for scholars. Saved scores automatically appear on the student's personal portal and synchronize directly with the Class Broadsheet.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer self-start border border-slate-700"
              title="Close score entry modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{saveSuccess}</span>
          </div>
          <button
            onClick={() => setSaveSuccess(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Student Lookup & Selection */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            1. Select Student Scholar from Directory
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            {allStudents.length} Active Scholars in Directory
          </span>
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Choose Student from Active Directory *
          </label>
          <select
            value={selectedStudentDropdownId}
            onChange={(e) => handleDropdownSelect(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Choose student from directory ({allStudents.length}) --</option>
            {allStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.surname}, {s.firstName} • {s.studentId} • {s.currentClass}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-slate-700/60 w-full" />
          <span className="bg-slate-800 px-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wider absolute">
            Or Search by Name / Class / Student ID
          </span>
        </div>

        <div className="flex gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupStudent())}
              placeholder="Search by student name, class (e.g. SS 3), or ID (e.g. FEN-2026-000001)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={handleLookupStudent}
            disabled={searchingStudent}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            {searchingStudent ? 'Searching...' : 'Find Student'}
          </button>
        </div>

        {searchError && <p className="text-xs text-rose-400">{searchError}</p>}

        {matchedStudent && (
          <div className="p-4 bg-slate-900/90 border border-emerald-500/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {matchedStudent.firstName} {matchedStudent.middleName ? matchedStudent.middleName + ' ' : ''}
                  {matchedStudent.surname}
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-emerald-400 font-medium">ID: {matchedStudent.studentId}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold text-[11px]">
                    Class: {matchedStudent.currentClass}
                  </span>
                  <span>Session: {matchedStudent.session || session}</span>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400">
              Verified Scholar
            </span>
          </div>
        )}
      </div>

      {/* Step 2: Score Details & Entry Form */}
      {matchedStudent && (
        <form
          onSubmit={handleSaveScore}
          className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-5 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                2. Score Entry: First Half / Terminal Term
              </h3>
              <span className="text-xs text-slate-400">
                Put the Continuous Assessment (CA max 40) and Main Examination (max 60) scores.
              </span>
            </div>

            {isSecondary ? (
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                Secondary Level (2 Exams/Term: 1st Half &amp; Terminal)
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                Primary Level (Terminal Exam: CA /40 + Exam /60 = 100)
              </span>
            )}
          </div>

          {/* Session, Term & Exam Period Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Academic Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="2026/2027">2026/2027</option>
                <option value="2025/2026">2025/2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Academic Term</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Term Period (First Half or Terminal) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExamPeriod('first-half')}
                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                    examPeriod === 'first-half'
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>First Half Term</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExamPeriod('terminal')}
                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                    examPeriod === 'terminal'
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Terminal Term</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Subject (includes Christian Religious Studies CRS & all subjects) *
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) {s.code === 'CRS' ? '✝️ Core Elective' : ''}
                </option>
              ))}
            </select>
            {selectedSubjectObj?.description && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                {selectedSubjectObj.description}
              </span>
            )}
          </div>

          {/* The Core Two Input Fields: CA (40) and Main Exam (60) */}
          <div className="bg-slate-950/70 border border-slate-750 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Raw Scores Breakdown for {selectedSubjectObj?.name || 'Selected Subject'}
              </span>
              <span className="text-xs text-amber-300 font-mono">
                Total Max Mark = 100
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CA Score Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300">
                    Continuous Assessment (CA) / Test Score
                  </label>
                  <span className="text-amber-400 font-mono font-bold">Max: 40</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="40"
                    step="0.5"
                    placeholder="0 - 40"
                    value={caScore}
                    onChange={(e) => setCaScore(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500 pr-16"
                  />
                  <span className="absolute right-3.5 top-3 text-xs text-slate-500 font-mono">
                    / 40
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Periodic continuous assessment, 6th-week test, practicals & projects
                </span>
              </div>

              {/* Main Exam Score Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300">
                    Main Examination Score
                  </label>
                  <span className="text-amber-400 font-mono font-bold">Max: 60</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    placeholder="0 - 60"
                    value={examScore}
                    onChange={(e) => setExamScore(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-emerald-500 pr-16"
                  />
                  <span className="absolute right-3.5 top-3 text-xs text-slate-500 font-mono">
                    / 60
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  End of term comprehensive examination paper
                </span>
              </div>
            </div>

            {/* Live Real-Time Aggregate Preview Bar */}
            <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 uppercase font-semibold">Live Total Calculation:</span>
                <span className="text-lg font-black text-amber-300 font-mono">
                  {numCa ?? 0} <span className="text-xs text-slate-400 font-normal">/40</span> + {numExam ?? 0}{' '}
                  <span className="text-xs text-slate-400 font-normal">/60</span> ={' '}
                  <strong className="text-emerald-400 text-xl">{liveTotal ?? 0}</strong>{' '}
                  <span className="text-xs text-slate-400 font-normal">/ 100</span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Percentage:</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 font-mono">
                  {livePercentage ?? 0}%
                </span>
                <span className="text-xs text-slate-400 font-medium ml-1">Grade:</span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 font-mono">
                  {liveGrade}
                </span>
              </div>
            </div>
          </div>

          {/* Teacher Comment */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Teacher Remark / Pedagogical Comment
            </label>
            <input
              type="text"
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="e.g. Excellent progress, strong understanding of the syllabus."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-750">
            <span className="text-xs text-slate-400">
              ⚡ Saving will instantly write to <strong>{matchedStudent.firstName}'s Portal</strong> and update the{' '}
              <strong>Class Broadsheet</strong>.
            </span>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950 border border-emerald-500/50 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-300" />
              {saving ? 'Saving Score to Broadsheet & Portal...' : 'SAVE SCORE RECORD'}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Existing Scores for the Matched Student (Editable & Deletable) */}
      {matchedStudent && (
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Existing Scores Recorded for {matchedStudent.firstName} {matchedStudent.surname}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                All previously entered CA and examination scores for {session} • {term}. Teachers can edit or delete any existing score below.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadStudentScores(matchedStudent)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingExistingScores ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingExistingScores ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Loading existing scores for {matchedStudent.firstName}...
            </div>
          ) : existingScores.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              No scores recorded yet for {matchedStudent.firstName} {matchedStudent.surname} in {term}. Use the form above to add scores.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Assessment Title</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-right">Max</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                    <th className="py-2.5 px-3">Remarks</th>
                    <th className="py-2.5 px-3 text-center">Actions (Edit / Delete)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 text-slate-300">
                  {existingScores.map((sc) => {
                    let parsedNote = sc.teacherComment || '—';
                    try {
                      if (sc.teacherComment && sc.teacherComment.trim().startsWith('{')) {
                        const obj = JSON.parse(sc.teacherComment);
                        parsedNote = obj.userNote || `CA: ${obj.caScore ?? '-'}, Exam: ${obj.examScore ?? '-'}`;
                      }
                    } catch (_) {}

                    return (
                      <tr key={sc.id} className="hover:bg-slate-750/50 transition">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {sc.subjectName || `Subject #${sc.subjectId}`}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{sc.assessmentTitle}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px]">
                            {sc.assessmentType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {sc.score}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                          {sc.maxScore}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                            {sc.grade || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 italic max-w-xs truncate">
                          {parsedNote}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditScore(sc)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-400 transition cursor-pointer"
                              title="Edit this recorded score"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteScore(sc.id, sc.subjectName || 'Score')}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 hover:border-rose-400 transition cursor-pointer"
                              title="Permanently delete this score record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* Edit Score Modal */}
      {editingScoreItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                Edit Recorded Score
              </h3>
              <button
                onClick={() => setEditingScoreItem(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-800 p-3 rounded-xl space-y-1">
                <span className="text-slate-400 block font-medium">Subject & Assessment:</span>
                <p className="font-bold text-white text-sm">
                  {editingScoreItem.subjectName || `Subject #${editingScoreItem.subjectId}`}
                </p>
                <p className="text-slate-400 text-xs">{editingScoreItem.assessmentTitle}</p>
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
                    value={editScoreCa}
                    onChange={(e) => setEditScoreCa(e.target.value)}
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
                    value={editScoreExam}
                    onChange={(e) => setEditScoreExam(e.target.value)}
                    placeholder="0 - 60"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Teacher Remarks
                </label>
                <input
                  type="text"
                  value={editScoreComment}
                  onChange={(e) => setEditScoreComment(e.target.value)}
                  placeholder="Feedback on scholar performance"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setEditingScoreItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEditedScore}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 text-amber-300" />
                {savingEdit ? 'Saving...' : 'Update Score Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

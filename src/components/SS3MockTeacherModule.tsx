import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import { SS3MockStudentDashboard } from './SS3MockStudentDashboard.tsx';
import {
  Award,
  Users,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  BookOpen,
  Eye,
  Plus,
  Trash2,
  TrendingUp,
  ShieldCheck,
  Info,
  Edit2,
  X
} from 'lucide-react';
import { Student, Subject } from '../types/index.ts';
import { getLocalStudents, fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import { fetchAllSubjectsUnified } from '../lib/subjectStore.ts';
import { supabase } from '../supabaseConfig.ts';
import { isSameClass } from '../constants/classes.ts';

export const SS3MockTeacherModule: React.FC = () => {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<'enter-scores' | 'broadsheet' | 'student-preview'>('enter-scores');

  // Students & Subjects list
  const [ss3Students, setSs3Students] = useState<Student[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState<number | string>('');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState<string>('2026/2027');
  const [term, setTerm] = useState<string>('Second Term');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedStudentObj = ss3Students.find(
    (s) => String(s.id) === String(selectedStudentId) || s.studentId === String(selectedStudentId)
  );

  // 4 Subjects Array
  interface SubjectScoreEntry {
    subjectId: number;
    subjectName: string;
    rawScore: string;
    maxRawScore: number;
    scaledScore: number;
    remark: string;
    isEnglish: boolean;
  }

  const [subjectEntries, setSubjectEntries] = useState<SubjectScoreEntry[]>([]);

  // Broadsheet state
  const [broadsheetWeek, setBroadsheetWeek] = useState<number>(1);
  const [broadsheetData, setBroadsheetData] = useState<any | null>(null);
  const [broadsheetLoading, setBroadsheetLoading] = useState(false);

  // Direct Broadsheet Cell / Student Edit Modal
  const [broadsheetEditModalOpen, setBroadsheetEditModalOpen] = useState(false);
  const [broadsheetActiveRow, setBroadsheetActiveRow] = useState<any | null>(null);
  const [broadsheetActiveSubject, setBroadsheetActiveSubject] = useState<any | null>(null);
  const [broadsheetEditRawScore, setBroadsheetEditRawScore] = useState<string>('');
  const [broadsheetEditSaving, setBroadsheetEditSaving] = useState(false);

  // Fetch initial SS3 students & subjects
  useEffect(() => {
    fetchInitialData();
    const handleStudentsUpdated = () => {
      const local = getLocalStudents();
      setSs3Students(local);
    };
    window.addEventListener('fis:students-updated', handleStudentsUpdated);
    return () => window.removeEventListener('fis:students-updated', handleStudentsUpdated);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Unified multi-source students fetch (LocalStorage, Supabase & PostgreSQL)
      const allStudents = await fetchAllStudentsUnified(token);
      let ss3List = allStudents.filter(
        (s) =>
          isSameClass(s.currentClass, 'SS 3') ||
          (s.currentClass || '').toUpperCase().includes('SS 3') ||
          (s.currentClass || '').toUpperCase().includes('SS3') ||
          (s.currentClass || '').toUpperCase().includes('SSS 3') ||
          (s.currentClass || '').toUpperCase().includes('SSS3')
      );
      if (ss3List.length === 0) {
        ss3List = allStudents;
      }
      setSs3Students(ss3List);
      if (selectedStudentId === '' && ss3List.length > 0) {
        setSelectedStudentId(ss3List[0].id);
      }

      // 2. Unified subjects fetch (Baseline, Custom, Supabase & Backend)
      const subs = await fetchAllSubjectsUnified(token);
      const hasCRS = subs.some((s) => s.code === 'CRS' || s.name.toLowerCase().includes('christian'));
      if (!hasCRS) {
        subs.push({
          id: 18,
          name: 'Christian Religious Studies',
          code: 'CRS',
          description: 'Biblical Studies & Christian Ethics (Elective • Graded over 40)',
          status: 'active',
          isCompulsory: false,
          defaultMaxRawScore: 40,
        });
      }
      setAvailableSubjects(subs);
      setupDepartmentPreset('science', subs);
    } catch (err: any) {
      console.warn('Initial data warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupDepartmentPreset = (preset: 'science' | 'commercial' | 'arts' | 'crs', subsList?: Subject[]) => {
    const list = subsList || availableSubjects;
    if (list.length === 0) return;

    let targetNames: string[] = [];
    if (preset === 'science') {
      targetNames = ['English Language', 'Mathematics', 'Physics', 'Chemistry'];
    } else if (preset === 'commercial') {
      targetNames = ['English Language', 'Mathematics', 'Economics', 'Commerce'];
    } else if (preset === 'crs') {
      targetNames = ['English Language', 'Christian Religious Studies', 'Literature in English', 'Government'];
    } else {
      targetNames = ['English Language', 'Christian Religious Studies', 'Literature in English', 'Government'];
    }

    const entries: SubjectScoreEntry[] = targetNames.map((name) => {
      let match = list.find((s) => {
        const sName = (s.name || '').toLowerCase();
        const sCode = (s.code || '').toUpperCase();
        if (name.toLowerCase().includes('christian') || name.toLowerCase().includes('crs')) {
          return sCode === 'CRS' || sName.includes('christian') || sName.includes('crs');
        }
        return sName === name.toLowerCase() || sName.includes(name.toLowerCase());
      });

      if (!match && (name.toLowerCase().includes('christian') || name.toLowerCase().includes('crs'))) {
        match = {
          id: 18,
          name: 'Christian Religious Studies',
          code: 'CRS',
          description: 'Biblical Studies & Christian Ethics (Elective • Graded over 40)',
          status: 'active',
          isCompulsory: false,
          defaultMaxRawScore: 40,
        };
        // Ensure availableSubjects also has CRS so the dropdown displays it
        setAvailableSubjects((prev) => (prev.some((p) => p.id === 18 || p.code === 'CRS') ? prev : [...prev, match!]));
      }

      if (!match) match = list[0];
      const lower = match.name.toLowerCase();
      // Only English Language is compulsory and over 60. Literature in English is an elective over 40 and not compulsory.
      const isEng = lower.includes('english') && !lower.includes('literature');
      return {
        subjectId: match.id,
        subjectName: match.name,
        rawScore: '',
        maxRawScore: isEng ? 60 : 40,
        scaledScore: 0,
        remark: 'Good',
        isEnglish: isEng,
      };
    });

    setSubjectEntries(entries);
  };

  // When a student or week is selected, load existing scores if already entered
  useEffect(() => {
    if (selectedStudentId && selectedWeek) {
      loadStudentScoresForWeek(Number(selectedStudentId), selectedWeek);
    }
  }, [selectedStudentId, selectedWeek]);

  const loadStudentScoresForWeek = async (stId: number, week: number) => {
    try {
      const existingMap = new Map<string, any>();

      // 1. Check local storage cache first
      try {
        const storedRaw = localStorage.getItem('fis_mock_scores_v2');
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw);
          const found = parsed.find(
            (m: any) => (Number(m.studentId) === stId || String(m.studentId) === String(stId)) && m.weekNumber === week
          );
          if (found && Array.isArray(found.subjects)) {
            for (const s of found.subjects) {
              const key = (s.subjectName || '').toLowerCase().trim();
              if (key) existingMap.set(key, s);
              if (s.subjectId) existingMap.set(String(s.subjectId), s);
            }
          }
        }
      } catch (_) {}

      // 2. Fetch live from backend
      try {
        const candidateNum = selectedStudentObj?.studentId || '';
        const res = await fetch(
          `/api/ss3-mock/scores?studentId=${stId}&studentNumber=${encodeURIComponent(candidateNum)}&weekNumber=${week}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const text = await res.text();
          let data: any = {};
          try { data = JSON.parse(text); } catch (_) {}
          const serverScores = data.scores || [];
          for (const s of serverScores) {
            const key = (s.subjectName || '').toLowerCase().trim();
            if (key) existingMap.set(key, s);
            if (s.subjectId) existingMap.set(String(s.subjectId), s);
          }
        }
      } catch (_) {}

      if (existingMap.size > 0) {
        // Collect all distinct saved subjects from existingMap so all saved scores stay visible & editable
        const loaded: SubjectScoreEntry[] = [];
        const seenKeys = new Set<string>();

        for (const [_, s] of existingMap.entries()) {
          const subName = (s.subjectName || '').trim();
          const cleanName = subName.toLowerCase();
          const subId = Number(s.subjectId) || 0;
          const dedupKey = `${subId}_${cleanName}`;
          if (seenKeys.has(dedupKey) || (cleanName && seenKeys.has(cleanName))) continue;
          if (cleanName) seenKeys.add(cleanName);
          seenKeys.add(dedupKey);

          const isEng = cleanName.includes('english') && !cleanName.includes('literature');
          const maxRaw = isEng ? 60 : 40;
          const rawStr = s.rawScore !== undefined && s.rawScore !== null ? String(s.rawScore) : '';
          const numRaw = parseFloat(rawStr) || 0;
          const scaled = s.score !== undefined ? Number(s.score) : (s.scaledScore !== undefined ? Number(s.scaledScore) : Math.min(100, Math.ceil((numRaw / maxRaw) * 100)));

          const matchedSub = availableSubjects.find((sub) => sub.id === subId || sub.name.toLowerCase() === cleanName);
          const finalId = matchedSub ? matchedSub.id : (subId || 1);
          const finalName = matchedSub ? matchedSub.name : (subName || 'Subject');

          loaded.push({
            subjectId: finalId,
            subjectName: finalName,
            rawScore: rawStr,
            maxRawScore: maxRaw,
            scaledScore: scaled,
            remark: s.remark || (scaled >= 75 ? 'Distinction' : scaled >= 50 ? 'Credit' : 'Good Progress'),
            isEnglish: isEng,
          });
        }

        if (loaded.length > 0) {
          loaded.sort((a, b) => {
            if (a.isEnglish) return -1;
            if (b.isEnglish) return 1;
            return a.subjectName.localeCompare(b.subjectName);
          });
          setSubjectEntries(loaded);
          return;
        }
      }

      // If no saved subjects exist for this student and week, initialize with preset
      setupDepartmentPreset('science');
    } catch (_) {}
  };

  const handleAddSubjectEntry = () => {
    const usedIds = new Set(subjectEntries.map((s) => s.subjectId));
    const nextSubject = availableSubjects.find((s) => !usedIds.has(s.id)) || availableSubjects[0];
    if (!nextSubject) return;

    const lower = nextSubject.name.toLowerCase();
    const isEng = lower.includes('english') && !lower.includes('literature');
    setSubjectEntries((prev) => [
      ...prev,
      {
        subjectId: nextSubject.id,
        subjectName: nextSubject.name,
        rawScore: '',
        maxRawScore: isEng ? 60 : 40,
        scaledScore: 0,
        remark: 'Good',
        isEnglish: isEng,
      },
    ]);
  };

  const handleDeleteSubject = async (index: number) => {
    const target = subjectEntries[index];
    if (!target) return;

    const candidateStudentId = selectedStudentObj?.id || selectedStudentId;
    const candidateStudentNumber = selectedStudentObj?.studentId || '';

    // 1. Remove from local form state immediately
    const updated = subjectEntries.filter((_, i) => i !== index);
    setSubjectEntries(updated);

    // 2. Remove from localStorage fis_mock_scores_v2
    try {
      const raw = localStorage.getItem('fis_mock_scores_v2');
      if (raw) {
        const list = JSON.parse(raw);
        const matchIdx = list.findIndex(
          (m: any) =>
            (String(m.studentId) === String(candidateStudentId) || (candidateStudentNumber && m.studentNumber === candidateStudentNumber)) &&
            m.weekNumber === selectedWeek
        );
        if (matchIdx !== -1) {
          const entry = list[matchIdx];
          if (Array.isArray(entry.subjects)) {
            entry.subjects = entry.subjects.filter(
              (s: any) =>
                s.subjectId !== target.subjectId &&
                (s.subjectName || '').toLowerCase().trim() !== (target.subjectName || '').toLowerCase().trim()
            );
            entry.totalScore400 = entry.subjects.reduce((sum: number, s: any) => sum + (s.score || s.scaledScore || 0), 0);
            entry.averagePercentage = Math.round(entry.totalScore400 / (entry.subjects.length || 4));
          }
          list[matchIdx] = entry;
          localStorage.setItem('fis_mock_scores_v2', JSON.stringify(list));
        }
      }
    } catch (_) {}

    // 3. Call backend DELETE endpoint
    try {
      await fetch(
        `/api/ss3-mock/scores?studentId=${candidateStudentId}&weekNumber=${selectedWeek}&subjectId=${target.subjectId}&subjectName=${encodeURIComponent(target.subjectName)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (_) {}

    // 4. Delete from Supabase
    try {
      if (candidateStudentNumber) {
        const { data: stRow } = await supabase
          .from('students')
          .select('id')
          .eq('student_id', candidateStudentNumber)
          .limit(1);
        const numId = stRow && stRow[0]?.id;
        if (numId) {
          await supabase
            .from('assessments')
            .delete()
            .eq('student_id', numId)
            .eq('assessment_type', 'SS3_MOCK')
            .eq('term', `Week ${selectedWeek}`)
            .eq('subject_id', target.subjectId);

          await supabase
            .from('ss3_mock_scores')
            .delete()
            .eq('student_id', numId)
            .eq('week_number', selectedWeek)
            .eq('subject_id', target.subjectId);
        }
      }
    } catch (_) {}

    window.dispatchEvent(
      new CustomEvent('fis:mock-scores-updated', {
        detail: {
          studentId: candidateStudentId,
          studentNumber: candidateStudentNumber,
          weekNumber: selectedWeek,
        },
      })
    );

    setStatusMessage({
      type: 'success',
      text: `Subject "${target.subjectName}" removed from Week ${selectedWeek} mock scores for student.`,
    });
  };

  // Delete an entire weekly mock result for a student
  const handleDeleteStudentWeeklyMock = async (stId: number | string, week: number, studentName?: string) => {
    const sName = studentName || selectedStudentObj?.firstName || 'this student';
    const confirmed = window.confirm(
      `⚠️ Delete Weekly Mock Result:\n\nAre you sure you want to delete Week ${week} mock examination result for ${sName}?\n\nThis will remove all recorded subject scores for Week ${week} and recalculate rankings.`
    );
    if (!confirmed) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const student = ss3Students.find((s) => String(s.id) === String(stId) || s.studentId === String(stId));
      const candidateStudentId = student?.id || stId;
      const candidateStudentNumber = student?.studentId || '';

      // 1. Call Backend DELETE endpoint
      try {
        await fetch(
          `/api/ss3-mock/scores?studentId=${candidateStudentId}&weekNumber=${week}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (e) {
        console.warn('Backend delete error:', e);
      }

      // 2. Direct Supabase cleanup
      try {
        if (candidateStudentNumber) {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .eq('student_id', candidateStudentNumber)
            .limit(1);
          const supaStId = stRow && stRow.length > 0 ? stRow[0].id : null;
          if (supaStId) {
            await supabase
              .from('assessments')
              .delete()
              .eq('student_id', supaStId)
              .eq('assessment_type', 'SS3_MOCK')
              .eq('term', `Week ${week}`);

            await supabase
              .from('ss3_mock_scores')
              .delete()
              .eq('student_id', supaStId)
              .eq('week_number', week);
          }
        }
      } catch (_) {}

      // 3. Remove from localStorage fis_mock_scores_v2 & student cache
      try {
        const raw = localStorage.getItem('fis_mock_scores_v2');
        if (raw) {
          const list = JSON.parse(raw);
          const filtered = list.filter(
            (m: any) =>
              !(
                (String(m.studentId) === String(candidateStudentId) ||
                  (candidateStudentNumber && m.studentNumber === candidateStudentNumber)) &&
                Number(m.weekNumber) === Number(week)
              )
          );
          localStorage.setItem('fis_mock_scores_v2', JSON.stringify(filtered));
        }
        localStorage.removeItem(`fis_mock_${candidateStudentId}_week_${week}`);
      } catch (_) {}

      // 4. Dispatch update event
      window.dispatchEvent(
        new CustomEvent('fis:mock-scores-updated', {
          detail: {
            studentId: candidateStudentId,
            studentNumber: candidateStudentNumber,
            weekNumber: week,
          },
        })
      );

      // 5. Refresh Broadsheet
      await fetchBroadsheet(week);

      // 6. Reset form if this student & week are active in enter-scores tab
      if (String(selectedStudentId) === String(candidateStudentId) && selectedWeek === week) {
        setupDepartmentPreset('science');
      }

      setStatusMessage({
        type: 'success',
        text: `Week ${week} mock examination result for ${sName} has been completely deleted.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to delete mock result',
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete all mock examination results for an entire week
  const handleDeleteWholeWeekMock = async (week: number) => {
    const confirmed = window.confirm(
      `⚠️ DANGER: Delete All Week ${week} Results:\n\nAre you sure you want to delete ALL student examination results for Week ${week}?\n\nThis will completely clear the broadsheet and remove all candidate records for Week ${week}. This action cannot be undone.`
    );
    if (!confirmed) return;

    setBroadsheetLoading(true);
    setStatusMessage(null);
    try {
      // 1. Call Backend DELETE endpoint
      try {
        await fetch(`/api/ss3-mock/scores?weekNumber=${week}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.warn('Backend delete whole week note:', e);
      }

      // 2. Direct Supabase cleanup
      try {
        await supabase
          .from('assessments')
          .delete()
          .eq('assessment_type', 'SS3_MOCK')
          .eq('term', `Week ${week}`);

        await supabase
          .from('ss3_mock_scores')
          .delete()
          .eq('week_number', week);
      } catch (_) {}

      // 3. Remove all week entries from localStorage
      try {
        const raw = localStorage.getItem('fis_mock_scores_v2');
        if (raw) {
          const list = JSON.parse(raw);
          const filtered = list.filter((m: any) => Number(m.weekNumber) !== Number(week));
          localStorage.setItem('fis_mock_scores_v2', JSON.stringify(filtered));
        }
      } catch (_) {}

      // 4. Dispatch update event
      window.dispatchEvent(
        new CustomEvent('fis:mock-scores-updated', {
          detail: { weekNumber: week },
        })
      );

      // 5. Refresh Broadsheet
      await fetchBroadsheet(week);

      setStatusMessage({
        type: 'success',
        text: `All mock examination results for Week ${week} have been deleted successfully.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to delete week mock results',
      });
    } finally {
      setBroadsheetLoading(false);
    }
  };

  // Delete a specific subject score from broadsheet modal
  const handleDeleteBroadsheetSubjectScore = async () => {
    if (!broadsheetActiveRow || !broadsheetActiveSubject) return;
    const subName = broadsheetActiveSubject.subjectName || 'this subject';
    const confirmed = window.confirm(`Remove ${subName} score for this student in Week ${broadsheetWeek}?`);
    if (!confirmed) return;

    setBroadsheetEditSaving(true);
    try {
      const student = broadsheetActiveRow.student || {};
      const targetStId = student.id || broadsheetActiveRow.studentId;
      const targetStNumber = student.studentId || broadsheetActiveRow.studentNumber || '';

      // Backend delete
      try {
        await fetch(
          `/api/ss3-mock/scores?studentId=${targetStId}&weekNumber=${broadsheetWeek}&subjectId=${broadsheetActiveSubject.subjectId}&subjectName=${encodeURIComponent(subName)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch (_) {}

      // LocalStorage update
      try {
        const raw = localStorage.getItem('fis_mock_scores_v2');
        if (raw) {
          const list = JSON.parse(raw);
          const entryIdx = list.findIndex(
            (m: any) =>
              (String(m.studentId) === String(targetStId) || (targetStNumber && m.studentNumber === targetStNumber)) &&
              Number(m.weekNumber) === Number(broadsheetWeek)
          );
          if (entryIdx !== -1) {
            const entry = list[entryIdx];
            if (Array.isArray(entry.subjects)) {
              entry.subjects = entry.subjects.filter(
                (s: any) =>
                  s.subjectId !== broadsheetActiveSubject.subjectId &&
                  (s.subjectName || '').toLowerCase().trim() !== (subName || '').toLowerCase().trim()
              );
              entry.totalScore400 = entry.subjects.slice(0, 4).reduce((sum: number, s: any) => sum + (s.score || s.scaledScore || 0), 0);
              entry.averagePercentage = Math.round((entry.totalScore400 / 400) * 1000) / 10;
            }
            list[entryIdx] = entry;
            localStorage.setItem('fis_mock_scores_v2', JSON.stringify(list));
          }
        }
      } catch (_) {}

      window.dispatchEvent(new CustomEvent('fis:mock-scores-updated', { detail: { weekNumber: broadsheetWeek } }));
      await fetchBroadsheet(broadsheetWeek);
      setBroadsheetEditModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: `Removed ${subName} score for ${student.firstName || 'student'} in Week ${broadsheetWeek}. Broadsheet updated.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to remove subject score' });
    } finally {
      setBroadsheetEditSaving(false);
    }
  };

  const handleRawScoreChange = (index: number, val: string) => {
    const updated = [...subjectEntries];
    const item = updated[index];
    item.rawScore = val;

    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      const clamped = Math.min(Math.max(0, num), item.maxRawScore);
      // Whole numbers rounded up for JAMB mock as requested
      item.scaledScore = Math.min(100, Math.ceil((clamped / item.maxRawScore) * 100));
    } else {
      item.scaledScore = 0;
    }

    setSubjectEntries(updated);
  };

  const handleSubjectPickerChange = (index: number, newSubId: number) => {
    const sub = availableSubjects.find((s) => s.id === newSubId);
    if (!sub) return;

    const updated = [...subjectEntries];
    const lower = sub.name.toLowerCase();
    // Only English Language is compulsory and over 60. Literature in English is an elective over 40.
    const isEng = lower.includes('english') && !lower.includes('literature');
    updated[index] = {
      ...updated[index],
      subjectId: sub.id,
      subjectName: sub.name,
      maxRawScore: isEng ? 60 : 40,
      isEnglish: isEng,
    };

    // Re-calculate scaled
    const num = parseFloat(updated[index].rawScore);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(0, num), updated[index].maxRawScore);
      updated[index].scaledScore = Math.min(100, Math.ceil((clamped / updated[index].maxRawScore) * 100));
    }

    setSubjectEntries(updated);
  };

  const handleRemarkChange = (index: number, text: string) => {
    const updated = [...subjectEntries];
    updated[index].remark = text;
    setSubjectEntries(updated);
  };

  // Compute live grand total over 400 (whole numbers)
  const grandTotal400 = Math.round(subjectEntries.reduce((sum, item) => sum + (item.scaledScore || 0), 0));
  const roundedGrandTotal = grandTotal400;
  const averagePercentage = Math.round((roundedGrandTotal / 400) * 1000) / 10;

  // Save Mock Scores to Backend
  const handleSaveScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setStatusMessage({ type: 'error', text: 'Please select a student' });
      return;
    }

    if (subjectEntries.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please enter at least one subject score' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const candidateStudentId = selectedStudentObj?.id || selectedStudentId;
      const candidateStudentNumber = selectedStudentObj?.studentId || (typeof selectedStudentId === 'string' && selectedStudentId.startsWith('FEN-') ? selectedStudentId : '');

      const payload = {
        studentId: candidateStudentId,
        studentNumber: candidateStudentNumber,
        firstName: selectedStudentObj?.firstName,
        surname: selectedStudentObj?.surname,
        weekNumber: selectedWeek,
        session,
        term,
        examDate,
        mockSeriesTitle: `SS3 Weekly Mock Series - Week ${selectedWeek}`,
        scores: subjectEntries.map((item) => ({
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          rawScore: item.rawScore !== '' ? parseFloat(item.rawScore) : 0,
          score: item.scaledScore,
          remark: item.remark,
        })),
      };

      // 1. Send to Backend API
      try {
        await fetch('/api/ss3-mock/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (netErr) {
        console.warn('Backend save deferred:', netErr);
      }

      // 2. Direct Sync to Supabase assessments & ss3_mock_scores tables
      try {
        let supaStudentId: number | null = null;
        if (candidateStudentNumber) {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .eq('student_id', candidateStudentNumber)
            .limit(1);
          if (stRow && stRow.length > 0) {
            supaStudentId = stRow[0].id;
          }
        }
        if (!supaStudentId && typeof candidateStudentId === 'number' && candidateStudentId < 1000000) {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .eq('id', candidateStudentId)
            .limit(1);
          if (stRow && stRow.length > 0) {
            supaStudentId = stRow[0].id;
          }
        }

        // If student not yet created in Supabase, provision them now
        if (!supaStudentId && candidateStudentNumber) {
          const { data: newSt } = await supabase.from('students').insert([{
            student_id: candidateStudentNumber,
            first_name: selectedStudentObj?.firstName || 'Student',
            surname: selectedStudentObj?.surname || 'Scholar',
            gender: selectedStudentObj?.gender || 'Female',
            current_class: selectedStudentObj?.currentClass || 'SS 3',
            school: selectedStudentObj?.school || 'Fenster International School',
            session: session || '2026/2027',
            school_id: 1,
          }]).select('id').single();
          if (newSt) supaStudentId = newSt.id;
        }

        if (supaStudentId) {
          for (const item of subjectEntries) {
            const rawNum = item.rawScore !== '' ? parseFloat(item.rawScore) : 0;
            const maxRaw = item.isEnglish ? 60 : 40;
            // Rounding up to whole integer as requested
            const scaled = Math.min(100, Math.ceil((rawNum / maxRaw) * 100));
            const grade = scaled >= 75 ? 'A1' : scaled >= 70 ? 'B2' : scaled >= 65 ? 'B3' : scaled >= 50 ? 'C4' : 'F9';
            const comment = JSON.stringify({
              rawScore: Math.round(rawNum),
              maxRawScore: maxRaw,
              formula: `(${Math.round(rawNum)} ÷ ${maxRaw}) × 100 = ${scaled}`,
              scaledScore: scaled,
              remark: item.remark || (scaled >= 75 ? 'Distinction' : scaled >= 50 ? 'Credit' : 'Needs Support'),
            });

            // Write to assessments table
            try {
              await supabase
                .from('assessments')
                .delete()
                .eq('student_id', supaStudentId)
                .eq('assessment_type', 'SS3_MOCK')
                .eq('term', `Week ${selectedWeek}`)
                .eq('subject_id', item.subjectId);

              await supabase.from('assessments').insert([{
                student_id: supaStudentId,
                subject_id: item.subjectId,
                assessment_type: 'SS3_MOCK',
                assessment_title: `SS3 Weekly Mock Series - Week ${selectedWeek}`,
                score: scaled,
                max_score: 100,
                percentage: scaled,
                grade,
                session,
                term: `Week ${selectedWeek}`,
                teacher_comment: comment,
                school_id: 1,
              }]);
            } catch (aErr) {
              console.warn('Supabase assessments table insert:', aErr);
            }

            // ALSO Write to ss3_mock_scores table in Supabase!
            try {
              await supabase
                .from('ss3_mock_scores')
                .delete()
                .eq('student_id', supaStudentId)
                .eq('week_number', selectedWeek)
                .eq('subject_id', item.subjectId);

              await supabase.from('ss3_mock_scores').insert([{
                student_id: supaStudentId,
                subject_id: item.subjectId,
                week_number: selectedWeek,
                mock_series_title: `SS3 Weekly Mock Series - Week ${selectedWeek}`,
                score: scaled,
                max_score: 100,
                percentage: scaled,
                grade,
                remark: item.remark || (scaled >= 75 ? 'Distinction' : scaled >= 50 ? 'Credit' : 'Needs Support'),
                term: 'Second Term',
                session,
                exam_date: examDate,
                school_id: 1,
              }]);
            } catch (mErr) {
              console.warn('Supabase ss3_mock_scores table insert:', mErr);
            }
          }
        }
      } catch (supaErr) {
        console.warn('Direct Supabase mock score sync deferred:', supaErr);
      }

      // 3. Persist locally to unified mock scores registry with full subject merging
      try {
        const storedScoresRaw = localStorage.getItem('fis_mock_scores_v2');
        const storedScores = storedScoresRaw ? JSON.parse(storedScoresRaw) : [];
        const existingEntry = storedScores.find(
          (m: any) =>
            (String(m.studentId) === String(candidateStudentId) || m.studentNumber === candidateStudentNumber) &&
            m.weekNumber === selectedWeek
        );

        const filtered = storedScores.filter(
          (m: any) =>
            !(
              (String(m.studentId) === String(candidateStudentId) || m.studentNumber === candidateStudentNumber) &&
              m.weekNumber === selectedWeek
            )
        );

        const mergedSubjectsMap = new Map<string, any>();
        if (existingEntry && Array.isArray(existingEntry.subjects)) {
          for (const sub of existingEntry.subjects) {
            const key = (sub.subjectName || '').toLowerCase().trim();
            if (key) mergedSubjectsMap.set(key, sub);
          }
        }

        for (const item of subjectEntries) {
          const key = (item.subjectName || '').toLowerCase().trim();
          const hasScore = item.rawScore !== '' || (item.scaledScore && item.scaledScore > 0);
          if (hasScore || !mergedSubjectsMap.has(key)) {
            mergedSubjectsMap.set(key, {
              ...item,
              rawScore: item.rawScore !== '' ? parseFloat(item.rawScore) : 0,
              formula: `(${item.rawScore || 0} ÷ ${item.isEnglish ? 60 : 40}) × 100 = ${item.scaledScore}`,
              grade: item.scaledScore >= 75 ? 'A1' : item.scaledScore >= 70 ? 'B2' : item.scaledScore >= 65 ? 'B3' : item.scaledScore >= 50 ? 'C4' : 'F9',
            });
          }
        }

        const finalSubjects = Array.from(mergedSubjectsMap.values());
        const totalScaled = finalSubjects.reduce((acc: number, curr: any) => acc + (curr.scaledScore || 0), 0);
        const finalAverage = Math.round(totalScaled / (finalSubjects.length || 4));

        filtered.push({
          studentId: candidateStudentId,
          studentNumber: candidateStudentNumber,
          studentName: selectedStudentObj ? `${selectedStudentObj.firstName} ${selectedStudentObj.surname}` : 'Student',
          weekNumber: selectedWeek,
          session,
          term,
          examDate,
          mockSeriesTitle: `SS3 Weekly Mock Series - Week ${selectedWeek}`,
          subjects: finalSubjects,
          totalScore400: totalScaled,
          averagePercentage: finalAverage,
        });
        localStorage.setItem('fis_mock_scores_v2', JSON.stringify(filtered));

        // Legacy student-week key
        const localKey = `fis_mock_${selectedStudentId}_week_${selectedWeek}`;
        localStorage.setItem(localKey, JSON.stringify(finalSubjects));
      } catch (_) {}

      // 4. Dispatch event so any student dashboard updates automatically
      window.dispatchEvent(
        new CustomEvent('fis:mock-scores-updated', {
          detail: {
            studentId: candidateStudentId,
            studentNumber: candidateStudentNumber,
            weekNumber: selectedWeek,
          },
        })
      );

      const candidateName = selectedStudentObj ? `${selectedStudentObj.firstName} ${selectedStudentObj.surname}` : 'Student';
      await loadStudentScoresForWeek(Number(candidateStudentId), selectedWeek);

      setStatusMessage({
        type: 'success',
        text: `Successfully saved Week ${selectedWeek} mock scores for ${candidateName}! Grand Total: ${roundedGrandTotal} / 400. Scores remain visible and editable here at any time.`,
      });

      // Refresh broadsheet if active
      if (broadsheetWeek === selectedWeek) {
        fetchBroadsheet(selectedWeek);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save mock scores' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Broadsheet
  const fetchBroadsheet = async (week: number) => {
    setBroadsheetLoading(true);
    try {
      let data: any = null;

      // 1. Fetch live from backend
      try {
        const res = await fetch(`/api/ss3-mock/broadsheet?weekNumber=${week}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            const parsed = JSON.parse(text);
            if (parsed && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
              data = parsed;
            }
          }
        }
      } catch (netErr) {
        console.warn('Backend broadsheet unavailable:', netErr);
      }

      // 2. Query Supabase ss3_mock_scores table if backend had no rows
      if (!data) {
        try {
          const { data: supaRows } = await supabase
            .from('ss3_mock_scores')
            .select('*, students(id, student_id, first_name, surname, gender, current_class), subjects(id, name, code)')
            .eq('week_number', week);

          if (supaRows && supaRows.length > 0) {
            const studentMap = new Map<string, any>();
            for (const item of supaRows) {
              const stId = item.student_id;
              const key = String(stId);
              if (!studentMap.has(key)) {
                studentMap.set(key, {
                  student: {
                    id: item.students?.id || stId,
                    studentId: item.students?.student_id || `FEN-SS3-${stId}`,
                    firstName: item.students?.first_name || 'Scholar',
                    surname: item.students?.surname || '',
                    gender: item.students?.gender || 'Scholar',
                  },
                  subjects: {},
                  subjectsList: [],
                });
              }
              const entry = studentMap.get(key);
              const subName = item.subjects?.name || item.subject_name || 'Subject';
              const isEng = subName.toLowerCase().includes('english') && !subName.toLowerCase().includes('literature');
              const subObj = {
                subjectId: item.subject_id,
                subjectName: subName,
                rawScore: item.raw_score !== undefined ? item.raw_score : Math.round((item.score || 0) * (isEng ? 0.6 : 0.4)),
                maxRawScore: isEng ? 60 : 40,
                scaledScore: item.score || item.percentage || 0,
                isEnglish: isEng,
              };
              entry.subjects[subName] = subObj;
              entry.subjectsList.push(subObj);
            }

            const rows = Array.from(studentMap.values()).map((r: any) => {
              const accepted = r.subjectsList.slice(0, 4);
              const total = accepted.reduce((sum: number, s: any) => sum + (Number(s.scaledScore) || 0), 0);
              const pct = Math.round((total / 400) * 1000) / 10;
              return {
                student: r.student,
                subjects: r.subjects,
                subjectsList: r.subjectsList,
                subjectsCount: r.subjectsList.length,
                totalScore400: total,
                averagePercentage: pct,
                rank: 1,
              };
            });

            rows.sort((a, b) => b.totalScore400 - a.totalScore400);
            rows.forEach((r, i) => { r.rank = i + 1; });
            const sumTotal = rows.reduce((acc, r) => acc + r.totalScore400, 0);

            data = {
              weekNumber: week,
              totalStudents: rows.length,
              participatingStudents: rows.filter((r) => r.subjectsCount > 0).length,
              classAverage: Math.round((sumTotal / (rows.length || 1)) * 10) / 10,
              highestScore: rows[0]?.totalScore400 || 0,
              lowestScore: rows[rows.length - 1]?.totalScore400 || 0,
              rows,
            };
          }
        } catch (supaErr) {
          console.warn('Supabase broadsheet fallback note:', supaErr);
        }
      }

      // 3. Fallback to localStorage fis_mock_scores_v2
      if (!data) {
        try {
          const storedRaw = localStorage.getItem('fis_mock_scores_v2');
          const storedList = storedRaw ? JSON.parse(storedRaw) : [];
          const weekScores = storedList.filter((m: any) => m.weekNumber === week);

          if (weekScores.length > 0) {
            const rows = weekScores.map((s: any, idx: number) => {
              const subjectsMap: Record<string, any> = {};
              const subjectsList: any[] = [];
              (s.subjects || []).forEach((sub: any) => {
                const subName = sub.subjectName || 'Subject';
                const isEng = sub.isEnglish || (subName.toLowerCase().includes('english') && !subName.toLowerCase().includes('literature'));
                const subObj = {
                  subjectId: sub.subjectId,
                  subjectName: subName,
                  rawScore: sub.rawScore !== undefined ? sub.rawScore : '',
                  maxRawScore: isEng ? 60 : 40,
                  scaledScore: sub.scaledScore !== undefined ? sub.scaledScore : (sub.score || 0),
                  isEnglish: isEng,
                };
                subjectsMap[subName] = subObj;
                subjectsList.push(subObj);
              });

              const total = s.totalScore400 !== undefined
                ? Number(s.totalScore400)
                : subjectsList.slice(0, 4).reduce((sum, sub) => sum + (sub.scaledScore || 0), 0);
              const pct = Math.round((Number(total) / 400) * 1000) / 10;

              const rawName = (s.studentName || 'Student Scholar').trim();
              const nameParts = rawName.split(' ');
              const fName = nameParts[0] || 'Candidate';
              const sName = nameParts.slice(1).join(' ') || '';

              return {
                student: {
                  id: s.studentId || idx + 1,
                  studentId: s.studentNumber || (typeof s.studentId === 'string' ? s.studentId : `FEN-SS3-${s.studentId || idx + 1}`),
                  firstName: fName,
                  surname: sName,
                  gender: s.gender || 'Scholar',
                },
                subjects: subjectsMap,
                subjectsList,
                subjectsCount: subjectsList.length,
                totalScore400: Number(total),
                averagePercentage: pct,
                grade: pct >= 75 ? 'A1' : pct >= 70 ? 'B2' : pct >= 65 ? 'B3' : pct >= 50 ? 'C4' : 'F9',
                rank: idx + 1,
                remark: Number(total) >= 300 ? 'Distinction - Ready for WAEC/UTME' : 'Commendable Performance',
              };
            });

            rows.sort((a: any, b: any) => b.totalScore400 - a.totalScore400);
            rows.forEach((r: any, i: number) => { r.rank = i + 1; });
            const sumTotal = rows.reduce((acc: number, r: any) => acc + r.totalScore400, 0);

            data = {
              weekNumber: week,
              totalStudents: rows.length,
              participatingStudents: rows.length,
              classAverage: Math.round((sumTotal / (rows.length || 1)) * 10) / 10,
              highestScore: rows[0]?.totalScore400 || 0,
              lowestScore: rows[rows.length - 1]?.totalScore400 || 0,
              rows,
            };
          }
        } catch (_) {}
      }

      if (data && Array.isArray(data.rows)) {
        setBroadsheetData(data);
      } else {
        setBroadsheetData({
          weekNumber: week,
          totalStudents: 0,
          participatingStudents: 0,
          classAverage: 0,
          highestScore: 0,
          lowestScore: 0,
          rows: [],
        });
      }
    } catch (err: any) {
      console.warn('Broadsheet warning:', err);
      setBroadsheetData({
        weekNumber: week,
        totalStudents: 0,
        participatingStudents: 0,
        classAverage: 0,
        highestScore: 0,
        lowestScore: 0,
        rows: [],
      });
    } finally {
      setBroadsheetLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'broadsheet') {
      fetchBroadsheet(broadsheetWeek);
    }
  }, [activeTab, broadsheetWeek]);

  // Open modal to edit score or subject directly from broadsheet view
  const handleOpenBroadsheetEdit = (row: any, subject?: any) => {
    setBroadsheetActiveRow(row);
    setBroadsheetActiveSubject(subject || null);
    setBroadsheetEditRawScore(subject?.rawScore !== undefined && subject?.rawScore !== null ? String(subject.rawScore) : '');
    setBroadsheetEditModalOpen(true);
  };

  // Save edited score directly from broadsheet modal
  const handleSaveBroadsheetEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadsheetActiveRow || !broadsheetActiveSubject) return;

    setBroadsheetEditSaving(true);
    try {
      const student = broadsheetActiveRow.student || {};
      const targetStId = student.id || broadsheetActiveRow.studentId;
      const targetStNumber = student.studentId || broadsheetActiveRow.studentNumber || '';

      const isEng = broadsheetActiveSubject.isEnglish ||
        (broadsheetActiveSubject.subjectName && broadsheetActiveSubject.subjectName.toLowerCase().includes('english') && !broadsheetActiveSubject.subjectName.toLowerCase().includes('literature'));
      const maxRaw = isEng ? 60 : 40;
      const numRaw = Math.min(Math.max(0, parseFloat(broadsheetEditRawScore) || 0), maxRaw);
      const scaled = Math.min(100, Math.ceil((numRaw / maxRaw) * 100));

      const payload = {
        studentId: targetStId,
        studentNumber: targetStNumber,
        weekNumber: broadsheetWeek,
        session,
        term,
        scores: [
          {
            subjectId: broadsheetActiveSubject.subjectId,
            subjectName: broadsheetActiveSubject.subjectName,
            rawScore: numRaw,
            score: scaled,
            remark: scaled >= 75 ? 'Distinction' : scaled >= 50 ? 'Credit' : 'Good Progress',
          },
        ],
      };

      // 1. Post to live backend
      try {
        await fetch('/api/ss3-mock/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } catch (_) {}

      // 2. Update local storage fis_mock_scores_v2
      try {
        const raw = localStorage.getItem('fis_mock_scores_v2');
        const list = raw ? JSON.parse(raw) : [];
        const entryIdx = list.findIndex(
          (m: any) =>
            (String(m.studentId) === String(targetStId) || (targetStNumber && m.studentNumber === targetStNumber)) &&
            m.weekNumber === broadsheetWeek
        );

        if (entryIdx !== -1) {
          const entry = list[entryIdx];
          if (Array.isArray(entry.subjects)) {
            const subIdx = entry.subjects.findIndex(
              (s: any) =>
                s.subjectId === broadsheetActiveSubject.subjectId ||
                (s.subjectName || '').toLowerCase().trim() === (broadsheetActiveSubject.subjectName || '').toLowerCase().trim()
            );
            const updatedSub = {
              ...broadsheetActiveSubject,
              rawScore: numRaw,
              maxRawScore: maxRaw,
              score: scaled,
              scaledScore: scaled,
              isEnglish: isEng,
            };
            if (subIdx !== -1) {
              entry.subjects[subIdx] = updatedSub;
            } else {
              entry.subjects.push(updatedSub);
            }
            entry.totalScore400 = entry.subjects.slice(0, 4).reduce((sum: number, s: any) => sum + (s.score || s.scaledScore || 0), 0);
            entry.averagePercentage = Math.round((entry.totalScore400 / 400) * 1000) / 10;
          }
          list[entryIdx] = entry;
          localStorage.setItem('fis_mock_scores_v2', JSON.stringify(list));
        }
      } catch (_) {}

      setStatusMessage({
        type: 'success',
        text: `Score for ${broadsheetActiveSubject.subjectName} updated to raw ${numRaw}/${maxRaw} (${scaled}%) in Week ${broadsheetWeek} Broadsheet!`,
      });

      setBroadsheetEditModalOpen(false);
      setBroadsheetActiveRow(null);
      setBroadsheetActiveSubject(null);

      // Refresh broadsheet
      fetchBroadsheet(broadsheetWeek);
    } catch (err: any) {
      console.error('Error updating broadsheet score:', err);
    } finally {
      setBroadsheetEditSaving(false);
    }
  };

  const filteredStudents = ss3Students.filter(
    (s) =>
      `${s.firstName} ${s.surname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
              Faculty & Super Admin Examination Desk
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
              Authorized Gradebook
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            SS3 Weekly Mock Assessment Manager
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Enter weekly mock exam scores for Senior Secondary 3 students. English Language is marked over 60 (compulsory); Literature in English and all other elective subjects are marked over 40 (not compulsory). Scores automatically scale to 100 each for a total aggregate over 400.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700 self-start md:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('enter-scores')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'enter-scores'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            Enter Scores
          </button>
          <button
            onClick={() => setActiveTab('broadsheet')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'broadsheet'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Class Broadsheet
          </button>
          <button
            onClick={() => setActiveTab('student-preview')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'student-preview'
                ? 'bg-emerald-700 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Student View
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
              : 'bg-red-950/80 border border-red-500 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: ENTER SCORES */}
      {activeTab === 'enter-scores' && (
        <form onSubmit={handleSaveScores} className="space-y-6">
          {/* Student & Week Selection Card */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              1. Select Student & Mock Week
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Student Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Select SS3 Candidate <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">-- Choose SS3 Student --</option>
                  {ss3Students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.surname} ({st.studentId}) - {st.currentClass}
                    </option>
                  ))}
                </select>
                {selectedStudentObj && (
                  <span className="text-[11px] text-amber-400 font-mono block">
                    Verified ID: {selectedStudentObj.studentId} • Session: {selectedStudentObj.session}
                  </span>
                )}
              </div>

              {/* Week Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Mock Assessment Week <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold text-amber-300"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Week {i + 1} Mock Examination
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 block">
                  Assessment Series: SS3 Weekly Mock Series - Week {selectedWeek}
                </span>
              </div>

              {/* Examination Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Exam Date
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-400 block">
                  Session: {session}
                </span>
              </div>
            </div>

            {/* Department Track Quick Selectors */}
            <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400 font-medium">
                Load 4-Subject Department Template:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setupDepartmentPreset('science')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  🧪 Science Track
                </button>
                <button
                  type="button"
                  onClick={() => setupDepartmentPreset('commercial')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  📈 Commercial Track
                </button>
                <button
                  type="button"
                  onClick={() => setupDepartmentPreset('arts')}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  🏛️ Arts & Humanities Track
                </button>
                <button
                  type="button"
                  onClick={() => setupDepartmentPreset('crs')}
                  className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-500/50 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  ✝️ CRS & Arts Track
                </button>
              </div>
            </div>
          </div>

          {/* Interactive 4-Subject Score Input Table */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  2. Subject Raw Score Input (4 Core Subjects)
                </h2>
                <span className="text-xs text-slate-400">
                  Enter the raw marks awarded by subject teachers. Scaled scores and aggregate over 400 are computed in real time.
                </span>
              </div>

              {/* Dynamic Live Aggregate Pill */}
              <div className="bg-slate-900 border border-emerald-500/50 rounded-xl px-4 py-2 flex items-center gap-3">
                <span className="text-xs text-slate-400 uppercase font-semibold">Live Aggregate:</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {roundedGrandTotal} <span className="text-xs font-normal text-slate-400">/ 400</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                  {averagePercentage}%
                </span>
              </div>
            </div>

            {/* Subject Entry Cards / Rows */}
            <div className="space-y-3">
              {subjectEntries.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/90 border border-slate-750 hover:border-slate-650 rounded-xl p-4 transition grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center relative"
                >
                  {/* Subject Name / Selector */}
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 block">
                      Subject #{idx + 1}{' '}
                      {item.isEnglish ? (
                        <span className="text-amber-400 font-bold ml-1">(Compulsory • Over 60)</span>
                      ) : (
                        <span className="text-slate-400 font-normal ml-1">(Elective • Over 40)</span>
                      )}
                    </label>
                    <select
                      value={String(item.subjectId)}
                      onChange={(e) => handleSubjectPickerChange(idx, Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                    >
                      {availableSubjects.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name} ({s.code}) {s.code === 'CRS' ? '✝️ Core Elective' : ''}
                        </option>
                      ))}
                      {!availableSubjects.some((s) => String(s.id) === String(item.subjectId)) && (
                        <option value={String(item.subjectId)}>
                          {item.subjectName}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Raw Score Input with specific /60 or /40 label */}
                  <div className="md:col-span-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Raw Score ({item.isEnglish ? 'over 60' : 'over 40'})
                      </label>
                      <span className="text-[10px] text-amber-400 font-mono">
                        Max: {item.maxRawScore}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max={item.maxRawScore}
                        step="0.5"
                        placeholder={`0 - ${item.maxRawScore}`}
                        value={item.rawScore}
                        onChange={(e) => handleRawScoreChange(idx, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold font-mono focus:outline-none focus:border-emerald-500 pr-14"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500 font-mono">
                        / {item.maxRawScore}
                      </span>
                    </div>
                  </div>

                  {/* Scaled Score Live Preview */}
                  <div className="md:col-span-2 space-y-1 text-center bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      Scaled Score
                    </span>
                    <span className="text-base font-extrabold text-emerald-400 font-mono">
                      {item.scaledScore}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">/ 100</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {item.isEnglish ? '(÷ 60 × 100)' : '(÷ 40 × 100)'}
                    </span>
                  </div>

                  {/* Teacher Remark */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 block">
                      Remark
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Good"
                      value={item.remark}
                      onChange={(e) => handleRemarkChange(idx, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Delete Subject Button */}
                  <div className="md:col-span-1 flex flex-col justify-end items-center h-full pt-4 md:pt-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(idx)}
                      title={`Delete mistakenly added subject: ${item.subjectName}`}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-400 transition cursor-pointer flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions: Add Another Subject & Guidance */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-1 border-t border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddSubjectEntry}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 self-start shadow-sm"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  + Add Another Subject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    let crsSub = availableSubjects.find(
                      (s) => s.code === 'CRS' || s.name.toLowerCase().includes('christian') || s.name.toLowerCase().includes('crs')
                    );
                    if (!crsSub) {
                      crsSub = {
                        id: 18,
                        name: 'Christian Religious Studies',
                        code: 'CRS',
                        description: 'Biblical Studies & Christian Ethics (Elective • Graded over 40)',
                        status: 'active',
                        isCompulsory: false,
                        defaultMaxRawScore: 40,
                      };
                      setAvailableSubjects((prev) => (prev.some((p) => p.id === 18 || p.code === 'CRS') ? prev : [...prev, crsSub!]));
                    }

                    const existingIdx = subjectEntries.findIndex(
                      (s) => s.subjectId === crsSub!.id || s.subjectName.toLowerCase().includes('christian') || s.subjectName.toLowerCase().includes('crs')
                    );

                    if (existingIdx === -1) {
                      const newEntry = {
                        subjectId: crsSub.id,
                        subjectName: crsSub.name,
                        rawScore: '',
                        maxRawScore: 40,
                        scaledScore: 0,
                        remark: 'Good',
                        isEnglish: false,
                      };
                      if (subjectEntries.length >= 4) {
                        // Replace the last elective so it stays 4 core subjects
                        const updated = [...subjectEntries];
                        updated[3] = newEntry;
                        setSubjectEntries(updated);
                        setStatusMessage({ type: 'success', text: 'Christian Religious Studies (CRS) is now selected and displayed in your 4-subject list!' });
                      } else {
                        setSubjectEntries([...subjectEntries, newEntry]);
                        setStatusMessage({ type: 'success', text: 'Christian Religious Studies (CRS) added to mock subject list!' });
                      }
                    } else {
                      setStatusMessage({ type: 'success', text: `Christian Religious Studies (CRS) is already in Subject #${existingIdx + 1} above.` });
                    }
                  }}
                  className="px-3.5 py-2 bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 self-start shadow-sm"
                >
                  ✝️ + Add CRS (Christian Religious Studies)
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                💡 Scores remain safely saved and editable at any time. Delete any mistakenly added subject using the red trash button.
              </span>
            </div>

            {/* Submission / Action Bar */}
            <div className="pt-4 border-t border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                <span>Saving will securely update the student's personal portal records for </span>
                <strong className="text-white">Week {selectedWeek}</strong>.
              </div>

              <div className="flex items-center gap-3">
                {subjectEntries.some((s) => s.rawScore !== '' && s.rawScore !== undefined) && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteStudentWeeklyMock(
                        selectedStudentId,
                        selectedWeek,
                        selectedStudentObj ? `${selectedStudentObj.firstName} ${selectedStudentObj.surname}` : 'Student'
                      )
                    }
                    disabled={loading}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-400 font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    title={`Delete this student's Week ${selectedWeek} mock examination result`}
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    Delete Week {selectedWeek} Result
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving Assessment...' : `Save Week ${selectedWeek} Mock Scores`}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: CLASS BROADSHEET */}
      {activeTab === 'broadsheet' && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-700 gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                SS3 Mock Examination Master Broadsheet (Week {broadsheetWeek})
              </h2>
              <span className="text-xs text-slate-400">
                Comparative ranking and 4-subject scaled scores out of 400 marks.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
                <span className="text-xs text-slate-400">Week:</span>
                <select
                  value={broadsheetWeek}
                  onChange={(e) => setBroadsheetWeek(Number(e.target.value))}
                  className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1} className="bg-slate-900 text-white">
                      Week {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => window.print()}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                Print Broadsheet
              </button>

              {broadsheetData && Array.isArray(broadsheetData.rows) && broadsheetData.rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleDeleteWholeWeekMock(broadsheetWeek)}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  title={`Delete all student mock scores for Week ${broadsheetWeek}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Delete Week {broadsheetWeek} Results
                </button>
              )}
            </div>
          </div>

          {broadsheetLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Loading SS3 mock broadsheet...
            </div>
          ) : !broadsheetData || !Array.isArray(broadsheetData.rows) || broadsheetData.rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No mock assessment records entered for Week {broadsheetWeek} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 font-bold uppercase text-[11px] bg-slate-900/60">
                    <th className="py-3 px-3 text-center">Rank</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3">Student ID</th>
                    <th className="py-3 px-3 text-center">English (Raw / Scaled)</th>
                    <th className="py-3 px-3 text-center">Subject 2</th>
                    <th className="py-3 px-3 text-center">Subject 3</th>
                    <th className="py-3 px-3 text-center">Subject 4</th>
                    <th className="py-3 px-3 text-center text-amber-400 font-black">
                      Total (/400)
                    </th>
                    <th className="py-3 px-3 text-center">Avg (%)</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {broadsheetData.rows.map((row: any, idx: number) => {
                    const student = row?.student || {};
                    const studentName = student.firstName || student.surname
                      ? `${student.firstName || ''} ${student.surname || ''}`.trim()
                      : row.studentName || 'SS3 Candidate';
                    const studentId = student.studentId || row.studentNumber || row.studentId || `FEN-SS3-${idx + 1}`;
                    const rowKey = student.id || studentId || idx;

                    let subsList: any[] = [];
                    if (Array.isArray(row.subjectsList) && row.subjectsList.length > 0) {
                      subsList = row.subjectsList;
                    } else if (Array.isArray(row.subjects)) {
                      subsList = row.subjects;
                    } else if (row.subjects && typeof row.subjects === 'object') {
                      subsList = Object.values(row.subjects);
                    } else if (row.scores && typeof row.scores === 'object') {
                      subsList = Object.entries(row.scores).map(([name, score]: [string, any]) => ({
                        subjectName: name,
                        rawScore: typeof score === 'object' ? score.rawScore : score,
                        scaledScore: typeof score === 'object' ? score.scaledScore : score,
                        isEnglish: name.toLowerCase().includes('english') && !name.toLowerCase().includes('literature'),
                      }));
                    }

                    const engSub = subsList.find((s) => s.isEnglish || (s.subjectName && s.subjectName.toLowerCase().includes('english') && !s.subjectName.toLowerCase().includes('literature')));
                    const otherSubs = subsList.filter((s) => s !== engSub);

                    return (
                      <tr key={rowKey} className="hover:bg-slate-750 transition">
                        <td className="py-3 px-3 text-center font-bold">
                          {row.rank ? (
                            <span
                              className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs ${
                                row.rank === 1
                                  ? 'bg-amber-500 text-slate-950 font-black shadow'
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

                        <td className="py-3 px-3 font-bold text-white">
                          {studentName}
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {studentId}
                        </td>

                        {/* English Column */}
                        <td
                          onClick={() => handleOpenBroadsheetEdit(row, engSub || { subjectName: 'English Language', isEnglish: true })}
                          className="py-3 px-3 text-center font-mono cursor-pointer hover:bg-slate-700/60 transition group/cell"
                          title="Click to edit raw score"
                        >
                          {engSub ? (
                            <div className="relative">
                              <span className="font-bold text-emerald-400 text-sm">
                                {engSub.scaledScore ?? engSub.score ?? 0}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                (raw {engSub.rawScore ?? '-'}/60)
                              </span>
                              <Edit2 className="w-3 h-3 text-amber-400 absolute right-0 top-0 opacity-0 group-hover/cell:opacity-100 transition" />
                            </div>
                          ) : (
                            <span className="text-slate-600 group-hover/cell:text-amber-400 transition text-[11px] flex items-center justify-center gap-1">
                              <Plus className="w-3 h-3" /> Add
                            </span>
                          )}
                        </td>

                        {/* Other 3 Subjects */}
                        {[0, 1, 2].map((subIdx) => {
                          const s = otherSubs[subIdx];
                          return (
                            <td
                              key={subIdx}
                              onClick={() => s && handleOpenBroadsheetEdit(row, s)}
                              className={`py-3 px-3 text-center font-mono ${s ? 'cursor-pointer hover:bg-slate-700/60' : ''} transition group/cell`}
                              title={s ? `Click to edit ${s.subjectName || 'subject'} score` : undefined}
                            >
                              {s ? (
                                <div className="relative">
                                  <span className="font-bold text-slate-200">
                                    {s.scaledScore ?? s.score ?? 0}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[90px] mx-auto">
                                    {s.subjectName || `Subject ${subIdx + 2}`} ({s.rawScore ?? '-'}/40)
                                  </span>
                                  <Edit2 className="w-3 h-3 text-amber-400 absolute right-0 top-0 opacity-0 group-hover/cell:opacity-100 transition" />
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Total Score / 400 */}
                        <td className="py-3 px-3 text-center font-mono font-black text-amber-300 text-sm bg-slate-900/40">
                          {row.totalScore400 ?? 0} / 400
                        </td>

                        {/* Avg % */}
                        <td className="py-3 px-3 text-center font-semibold text-emerald-400">
                          {row.averagePercentage ?? 0}%
                        </td>

                        {/* Actions: Edit all or Delete this student's week result */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const candidateId = row.student?.id || row.studentId;
                                if (candidateId) {
                                  setSelectedStudentId(candidateId);
                                  setSelectedWeek(broadsheetWeek);
                                  setActiveTab('enter-scores');
                                }
                              }}
                              title={`Edit all scores for ${studentName} in Week ${broadsheetWeek}`}
                              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 hover:text-white transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteStudentWeeklyMock(
                                  row.student?.id || row.studentId,
                                  broadsheetWeek,
                                  studentName
                                )
                              }
                              title={`Delete Week ${broadsheetWeek} mock result for ${studentName}`}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-400 transition cursor-pointer"
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

      {/* Broadsheet Score Edit Modal */}
      {broadsheetEditModalOpen && broadsheetActiveRow && broadsheetActiveSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-400" />
                  Edit Score: {broadsheetActiveSubject.subjectName || 'Subject'}
                </h3>
                <span className="text-xs text-slate-400">
                  {broadsheetActiveRow.student?.firstName || broadsheetActiveRow.studentName} {broadsheetActiveRow.student?.surname || ''} • Week {broadsheetWeek} Broadsheet
                </span>
              </div>
              <button
                onClick={() => setBroadsheetEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBroadsheetEdit} className="space-y-4">
              {(() => {
                const isEng = broadsheetActiveSubject.isEnglish ||
                  (broadsheetActiveSubject.subjectName && broadsheetActiveSubject.subjectName.toLowerCase().includes('english') && !broadsheetActiveSubject.subjectName.toLowerCase().includes('literature'));
                const maxRaw = isEng ? 60 : 40;
                const num = parseFloat(broadsheetEditRawScore) || 0;
                const clamped = Math.min(Math.max(0, num), maxRaw);
                const scaled = Math.min(100, Math.ceil((clamped / maxRaw) * 100));

                return (
                  <>
                    <div className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-300">
                      <strong>Score Rule:</strong> {isEng ? 'English Language is compulsory and marked over 60.' : `${broadsheetActiveSubject.subjectName || 'Elective'} is marked over 40.`} Scores automatically scale to 100.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Raw Mark Awarded (over {maxRaw})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={maxRaw}
                          step="any"
                          required
                          value={broadsheetEditRawScore}
                          onChange={(e) => setBroadsheetEditRawScore(e.target.value)}
                          placeholder={`0 - ${maxRaw}`}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                          / {maxRaw}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block">Scaled Score (over 100):</span>
                        <span className="text-xl font-black text-amber-300 font-mono">
                          {scaled} / 100
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Formula:</span>
                        <span className="text-xs font-mono text-slate-300">
                          ({clamped} ÷ {maxRaw}) × 100
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handleDeleteBroadsheetSubjectScore}
                        disabled={broadsheetEditSaving}
                        className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                        title="Delete this subject score for this student in this week"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        Delete Subject Score
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBroadsheetEditModalOpen(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={broadsheetEditSaving}
                          className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                        >
                          <Save className="w-4 h-4 text-amber-400" />
                          {broadsheetEditSaving ? 'Saving...' : 'Update Score in Broadsheet'}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT VIEW PREVIEW */}
      {activeTab === 'student-preview' && (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-amber-400" />
              <div>
                <span className="font-bold text-white text-xs block">
                  Previewing Student Portal: {selectedStudentObj?.firstName} {selectedStudentObj?.surname}
                </span>
                <span className="text-[11px] text-slate-400">
                  This is the exact view the student sees when logging into the portal at home with their Student ID and password.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                {ss3Students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.firstName} {st.surname} ({st.studentId})
                  </option>
                ))}
              </select>

              {selectedStudentId && (
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteStudentWeeklyMock(
                      selectedStudentId,
                      selectedWeek,
                      selectedStudentObj ? `${selectedStudentObj.firstName} ${selectedStudentObj.surname}` : 'Student'
                    )
                  }
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
                  title={`Delete Week ${selectedWeek} mock result for this student`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Delete Week {selectedWeek} Result
                </button>
              )}
            </div>
          </div>

          <SS3MockStudentDashboard
            studentDbId={selectedStudentId ? Number(selectedStudentId) : undefined}
            readOnly={false}
          />
        </div>
      )}
    </div>
  );
};

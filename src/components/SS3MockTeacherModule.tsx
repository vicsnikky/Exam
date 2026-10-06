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
  Info
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
      setAvailableSubjects(subs);
      setupDepartmentPreset('science', subs);
    } catch (err: any) {
      console.warn('Initial data warning:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupDepartmentPreset = (preset: 'science' | 'commercial' | 'arts', subsList?: Subject[]) => {
    const list = subsList || availableSubjects;
    if (list.length === 0) return;

    let targetNames: string[] = [];
    if (preset === 'science') {
      targetNames = ['English Language', 'Mathematics', 'Physics', 'Chemistry'];
    } else if (preset === 'commercial') {
      targetNames = ['English Language', 'Mathematics', 'Economics', 'Commerce'];
    } else {
      targetNames = ['English Language', 'Literature in English', 'Government', 'Civic Education'];
    }

    const entries: SubjectScoreEntry[] = targetNames.map((name) => {
      const match = list.find((s) => s.name.toLowerCase() === name.toLowerCase()) || list[0];
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
          const data = await res.json();
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
      try {
        const res = await fetch(`/api/ss3-mock/broadsheet?weekNumber=${week}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            data = JSON.parse(text);
          }
        }
      } catch (netErr) {
        console.warn('Backend broadsheet unavailable:', netErr);
      }

      if (data) {
        setBroadsheetData(data);
      } else {
        // Calculate broadsheet strictly from actual registered students
        try {
          const storedRaw = localStorage.getItem('fis_mock_scores_v2');
          const storedList = storedRaw ? JSON.parse(storedRaw) : [];
          const weekScores = storedList.filter((m: any) => m.weekNumber === week);

          if (weekScores.length > 0) {
            const rows = weekScores.map((s: any, idx: number) => {
              const scoresMap: Record<string, number> = {};
              (s.subjects || []).forEach((sub: any) => {
                scoresMap[sub.subjectName] = sub.scaledScore !== undefined ? sub.scaledScore : sub.score;
              });
              const total = s.totalScore400 || Object.values(scoresMap).reduce((a: any, b: any) => Number(a) + Number(b), 0);
              const pct = Math.round((Number(total) / 400) * 1000) / 10;
              return {
                studentId: s.studentNumber,
                studentName: s.studentName,
                gender: s.gender || 'Scholar',
                scores: scoresMap,
                totalScore400: Number(total),
                percentage: pct,
                grade: pct >= 75 ? 'A1' : pct >= 70 ? 'B2' : pct >= 65 ? 'B3' : pct >= 50 ? 'C4' : 'F9',
                rank: idx + 1,
                remark: Number(total) >= 300 ? 'Distinction - Ready for WAEC/UTME' : 'Commendable Performance',
              };
            });
            rows.sort((a: any, b: any) => b.totalScore400 - a.totalScore400);
            rows.forEach((r: any, i: number) => { r.rank = i + 1; });
            const sumTotal = rows.reduce((acc: number, r: any) => acc + r.totalScore400, 0);
            setBroadsheetData({
              weekNumber: week,
              totalCandidates: rows.length,
              classAverage: Math.round((sumTotal / rows.length) * 10) / 10,
              highestScore: rows[0]?.totalScore400 || 0,
              lowestScore: rows[rows.length - 1]?.totalScore400 || 0,
              rows,
            });
          } else {
            setBroadsheetData({
              weekNumber: week,
              totalCandidates: 0,
              classAverage: 0,
              highestScore: 0,
              lowestScore: 0,
              rows: [],
            });
          }
        } catch (_) {
          setBroadsheetData({
            weekNumber: week,
            totalCandidates: 0,
            classAverage: 0,
            highestScore: 0,
            lowestScore: 0,
            rows: [],
          });
        }
      }
    } catch (err: any) {
      console.warn('Broadsheet warning:', err);
    } finally {
      setBroadsheetLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'broadsheet') {
      fetchBroadsheet(broadsheetWeek);
    }
  }, [activeTab, broadsheetWeek]);

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
                      value={item.subjectId}
                      onChange={(e) => handleSubjectPickerChange(idx, Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-emerald-500"
                    >
                      {availableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
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
              <button
                type="button"
                onClick={handleAddSubjectEntry}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 self-start shadow-sm"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                + Add Another Subject to Mock
              </button>
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
            </div>
          </div>

          {broadsheetLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Loading SS3 mock broadsheet...
            </div>
          ) : !broadsheetData || broadsheetData.rows.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {broadsheetData.rows.map((row: any, idx: number) => {
                    const subsList = Object.values(row.subjects) as any[];
                    const engSub = subsList.find((s) => s.isEnglish);
                    const otherSubs = subsList.filter((s) => !s.isEnglish);

                    return (
                      <tr key={row.student.id} className="hover:bg-slate-750 transition">
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
                          {row.student.firstName} {row.student.surname}
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {row.student.studentId}
                        </td>

                        {/* English Column */}
                        <td className="py-3 px-3 text-center font-mono">
                          {engSub ? (
                            <div>
                              <span className="font-bold text-emerald-400 text-sm">
                                {engSub.scaledScore}
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                (raw {engSub.rawScore}/60)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600">Pending</span>
                          )}
                        </td>

                        {/* Other 3 Subjects */}
                        {[0, 1, 2].map((subIdx) => {
                          const s = otherSubs[subIdx];
                          return (
                            <td key={subIdx} className="py-3 px-3 text-center font-mono">
                              {s ? (
                                <div>
                                  <span className="font-bold text-slate-200">
                                    {s.scaledScore}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate max-w-[90px] mx-auto">
                                    {s.subjectName} ({s.rawScore}/40)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Total Score / 400 */}
                        <td className="py-3 px-3 text-center font-mono font-black text-amber-300 text-sm bg-slate-900/40">
                          {row.totalScore400} / 400
                        </td>

                        {/* Avg % */}
                        <td className="py-3 px-3 text-center font-semibold text-emerald-400">
                          {row.averagePercentage}%
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

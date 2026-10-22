import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  FileText,
  Filter,
  Download,
  Search,
  CheckCircle,
  FileSpreadsheet,
  Award,
  ChevronRight,
  Loader2,
  Printer,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  MessageSquare,
  GraduationCap,
} from 'lucide-react';
import { Subject } from '../types/index.ts';
import { SCHOOL_CLASSES } from '../constants/classes.ts';
import { ClassBroadsheet } from './ClassBroadsheet.tsx';
import { fetchStudentComments, saveStudentComments } from '../lib/schoolStore.ts';

export const ResultsView: React.FC = () => {
  const { token, user } = useAuth();

  const isVictorSuperAdmin = user?.role === 'super_admin' || user?.email?.toLowerCase() === 'victoralo1862@gmail.com';
  const isDirector = user?.role === 'director';
  const isPrincipal = user?.role === 'principal';
  const isAdmin = user?.role === 'admin';
  const isExecutive = isVictorSuperAdmin || isDirector || isPrincipal || isAdmin;

  const isClassTeacher = Boolean(
    user?.isClassTeacher ||
    user?.assignedClass ||
    (typeof window !== 'undefined' && (() => {
      try {
        const raw = localStorage.getItem('fis_class_teachers_v1');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const tchId = user?.teacherId || '';
        const email = user?.email?.toLowerCase() || '';
        const userId = user?.id ? String(user.id) : '';
        return Boolean(parsed[tchId] || parsed[userId] || parsed[email]);
      } catch (_) {
        return false;
      }
    })())
  );

  const canAccessBroadsheet = isExecutive || isClassTeacher;

  const [viewMode, setViewMode] = useState<'broadsheet' | 'ledger'>('broadsheet');
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // Score edit modal state
  const [editingScore, setEditingScore] = useState<any | null>(null);
  const [editScoreValue, setEditScoreValue] = useState<string>('');
  const [editMaxScoreValue, setEditMaxScoreValue] = useState<string>('100');
  const [editSubjectId, setEditSubjectId] = useState<string>('');
  const [editComment, setEditComment] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dedicated Comment Modal for Results View (Class Teacher & Principal Comments)
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentStudentRecord, setCommentStudentRecord] = useState<any | null>(null);
  const [commentDraftTeacher, setCommentDraftTeacher] = useState('');
  const [commentDraftPrincipal, setCommentDraftPrincipal] = useState('');
  const [savingComments, setSavingComments] = useState(false);

  const canEditTeacherComment = isClassTeacher || isExecutive;
  const canEditPrincipalComment = isExecutive;

  const handleOpenCommentsModal = async (record: any) => {
    setCommentStudentRecord(record);
    const sId = record.studentId || String(record.studentDbId);
    const term = record.term || 'First Term';
    const session = record.session || '2026/2027';
    try {
      const comments = await fetchStudentComments(sId, term, session, token);
      setCommentDraftTeacher(comments.classTeacherComment || '');
      setCommentDraftPrincipal(comments.principalComment || '');
    } catch (_) {
      setCommentDraftTeacher('');
      setCommentDraftPrincipal('');
    }
    setCommentModalOpen(true);
  };

  const handleSaveComments = async () => {
    if (!commentStudentRecord) return;
    setSavingComments(true);
    try {
      const sId = commentStudentRecord.studentId || String(commentStudentRecord.studentDbId);
      const payload: any = {
        term: commentStudentRecord.term || 'First Term',
        session: commentStudentRecord.session || '2026/2027',
      };
      if (canEditTeacherComment) {
        payload.classTeacherComment = commentDraftTeacher;
        payload.teacherName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Class Teacher';
      }
      if (canEditPrincipalComment) {
        payload.principalComment = commentDraftPrincipal;
        payload.principalName = 'School Principal';
      }

      await saveStudentComments(sId, payload, token);
      window.dispatchEvent(new CustomEvent('fis:comments-updated'));
      window.dispatchEvent(new CustomEvent('fis:student-comments-updated', { detail: { studentId: sId, ...payload } }));

      setStatusMessage({
        type: 'success',
        text: `Official comments updated successfully for ${commentStudentRecord.studentName}!`,
      });
      setCommentModalOpen(false);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to save comments: ' + (err.message || 'Error'),
      });
    } finally {
      setSavingComments(false);
    }
  };

  // Filters
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('all');
  const [selectedSession, setSelectedSession] = useState('all');

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (studentQuery) params.set('student', studentQuery);
      if (selectedClass && selectedClass !== 'all') params.set('class', selectedClass);
      if (selectedSubjectId) params.set('subjectId', selectedSubjectId);
      if (selectedTerm && selectedTerm !== 'all') params.set('term', selectedTerm);
      if (selectedSession && selectedSession !== 'all') params.set('session', selectedSession);

      const res = await fetch(`/api/scores?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch (_) {}
      const rawList = data.results || [];

      const deletedRaw = localStorage.getItem('fis_deleted_score_ids_v1');
      const deletedIds = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);

      const filtered = rawList.filter((r: any) => {
        if (deletedIds.has(String(r.id))) return false;
        if (r.studentDbId && r.subjectId && deletedIds.has(`key_${r.studentDbId}_${r.subjectId}`)) return false;
        if (r.studentId && r.subjectId && deletedIds.has(`key_${r.studentId}_${r.subjectId}`)) return false;
        return true;
      });

      setResults(filtered);
    } catch (e) {
      console.error('Failed to load results:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/subjects', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((text) => {
        try {
          const d = JSON.parse(text);
          setSubjects(d.subjects || []);
        } catch (_) {}
      })
      .catch(() => {});

    fetchResults();
  }, [token]);

  // Open edit score modal
  const handleOpenEdit = (rec: any) => {
    setEditingScore(rec);
    setEditScoreValue(String(rec.score));
    setEditMaxScoreValue(String(rec.maxScore || 100));
    setEditSubjectId(String(rec.subjectId || ''));
    setEditComment(rec.teacherComment || '');
  };

  // Submit edit score
  const handleSaveScoreEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScore) return;

    setEditSaving(true);
    setStatusMessage(null);
    try {
      const numScore = Number(editScoreValue);
      const numMax = Number(editMaxScoreValue);

      const res = await fetch(`/api/scores/${editingScore.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          score: numScore,
          maxScore: numMax,
          subjectId: editSubjectId ? Number(editSubjectId) : undefined,
          teacherComment: editComment,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update score');
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully updated score to ${numScore}/${numMax} for ${editingScore.studentName}!`,
      });

      setEditingScore(null);
      fetchResults();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update score' });
    } finally {
      setEditSaving(false);
    }
  };

  // Delete score
  const handleDeleteScore = async (id: number | string, studentName: string) => {
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

      const targetRec = results.find((r) => String(r.id) === String(id));

      // Optimistically update list
      setResults((prev) => prev.filter((r) => String(r.id) !== String(id)));

      // Add to persistent deleted IDs set
      try {
        const deletedRaw = localStorage.getItem('fis_deleted_score_ids_v1');
        const deletedIds = new Set<string>(deletedRaw ? JSON.parse(deletedRaw) : []);
        deletedIds.add(String(id));
        if (targetRec?.id) deletedIds.add(String(targetRec.id));
        if (targetRec?.studentDbId && targetRec?.subjectId) {
          deletedIds.add(`key_${targetRec.studentDbId}_${targetRec.subjectId}`);
          if (targetRec.assessmentType) deletedIds.add(`key_${targetRec.studentDbId}_${targetRec.subjectId}_${targetRec.assessmentType}`);
        }
        if (targetRec?.studentId && targetRec?.subjectId) {
          deletedIds.add(`key_${targetRec.studentId}_${targetRec.subjectId}`);
          if (targetRec.assessmentType) deletedIds.add(`key_${targetRec.studentId}_${targetRec.subjectId}_${targetRec.assessmentType}`);
        }
        localStorage.setItem('fis_deleted_score_ids_v1', JSON.stringify([...deletedIds]));
      } catch (_) {}

      // Clean local broadsheet cache
      try {
        const cached = localStorage.getItem('fis_broadsheet_scores_v2');
        if (cached) {
          const list = JSON.parse(cached);
          const filtered = list.filter((l: any) => {
            if (String(l.id) === String(id) || String(l.testId) === String(id) || String(l.examId) === String(id)) return false;
            const matchesSt = targetRec && (l.studentId === targetRec.studentDbId || l.studentNumber === targetRec.studentId);
            const matchesSub = targetRec && Number(l.subjectId) === Number(targetRec.subjectId);
            if (matchesSt && matchesSub) return false;
            return true;
          });
          localStorage.setItem('fis_broadsheet_scores_v2', JSON.stringify(filtered));
        }
      } catch (_) {}

      const queryParams = new URLSearchParams();
      if (targetRec?.studentDbId) queryParams.set('studentId', String(targetRec.studentDbId));
      if (targetRec?.studentId) queryParams.set('studentNumber', targetRec.studentId);
      if (targetRec?.subjectId) queryParams.set('subjectId', String(targetRec.subjectId));
      if (targetRec?.term) queryParams.set('term', targetRec.term);
      if (targetRec?.assessmentType) queryParams.set('assessmentType', targetRec.assessmentType);

      const res = await fetch(`/api/scores/${encodeURIComponent(String(id))}?${queryParams.toString()}`, {
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

      window.dispatchEvent(new CustomEvent('fis:scores-updated'));
      window.dispatchEvent(new CustomEvent('fis:broadsheet-scores-updated'));

      setStatusMessage({
        type: 'success',
        text: `Score record removed successfully for ${studentName}.`,
      });
      fetchResults();
    } catch (err: any) {
      console.error('Delete score error in ResultsView:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete score' });
      fetchResults();
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = ['Student ID', 'Student Name', 'Class', 'Subject', 'Assessment', 'Score', 'Max Score', 'Percentage', 'Grade', 'Session', 'Term', 'Teacher Remarks'];
    const rows = results.map((r) => [
      `"${r.studentId}"`,
      `"${r.studentName}"`,
      `"${r.class}"`,
      `"${r.subjectName}"`,
      `"${r.assessmentTitle}"`,
      r.score,
      r.maxScore,
      `${r.percentage}%`,
      r.grade,
      `"${r.session}"`,
      `"${r.term}"`,
      `"${(r.teacherComment || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `School_Assessment_Results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canAccessBroadsheet) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white">Broadsheet Access Restricted</h3>
        <p className="text-sm text-slate-300 max-w-lg mx-auto">
          Master class broadsheets and official term ledgers are reserved for <strong className="text-amber-300">Class Teachers</strong>, <strong className="text-white">School Administrators</strong>, and <strong className="text-emerald-400">Super Administrators</strong>.
        </p>
        <p className="text-xs text-slate-400">
          As a subject specialist teacher, you are authorized to input and review scholar subject scores directly via the Score Entry Portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 fis-card-accent">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                Fenster International School
              </span>
              <span className="px-2 py-0.2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
                Official Transcript & Ledger
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-0.5">
              Academic Assessment & Examination Records
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Filter, examine, and export authenticated score ledgers across all students and curriculum subjects.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(isExecutive || isClassTeacher) && (
            <button
              onClick={() => {
                sessionStorage.setItem('fis_auto_open_batch_print', 'true');
                setViewMode('broadsheet');
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('fis:trigger-batch-print'));
                }, 50);
              }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-950 border border-emerald-400/40"
              title="Print all report cards and broadsheet results for the class at once"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print All Class Results</span>
            </button>
          )}
          {viewMode === 'ledger' && (
            <button
              onClick={handleExportCSV}
              disabled={results.length === 0}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 border border-emerald-600/50 shadow-md shadow-emerald-950"
            >
              <Download className="w-4 h-4 text-amber-400" />
              Export to CSV
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Sub Navigation Tabs: Class Broadsheet vs All Score Records */}
      <div className="flex border-b border-slate-700 gap-2">
        <button
          onClick={() => setViewMode('broadsheet')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 border-t border-x ${
            viewMode === 'broadsheet'
              ? 'bg-slate-800 text-emerald-400 border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/40'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          Class Broadsheet View (Editable Subject Matrix & Averages)
        </button>
        <button
          onClick={() => setViewMode('ledger')}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 border-t border-x ${
            viewMode === 'ledger'
              ? 'bg-slate-800 text-emerald-400 border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-800/40'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-400" />
          All Score Ledgers & Audit Log ({results.length})
        </button>
      </div>

      {viewMode === 'broadsheet' && (
        <ClassBroadsheet />
      )}

      {viewMode === 'ledger' && (
        <>
          {/* Filter Bar */}
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Search Student / ID</label>
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Name or FIS ID..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Classes</option>
                {SCHOOL_CLASSES.map((cName) => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((s, idx) => (
                  <option key={`rv_sub_${s.id}_${s.code || ''}_${idx}`} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Terms</option>
                <option value="First Term">First Term</option>
                <option value="Second Term">Second Term</option>
                <option value="Third Term">Third Term</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchResults}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Filter className="w-3.5 h-3.5" />
                Apply Filters
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-700 text-xs text-slate-400 flex items-center justify-between">
              <span>Found <strong>{results.length}</strong> recorded assessment score(s)</span>
              <span>Teachers can correct any mistaken score directly via the Edit button</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span>Fetching assessment records...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No score records found</p>
                <p className="text-xs mt-1">Try resetting the filters or record scores from the "Add Score" tab.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Assessment</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-right">Percentage</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                      <th className="py-3 px-4">Session / Term</th>
                      <th className="py-3 px-4">Remarks</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-300">
                    {results.map((r, idx) => (
                      <tr key={`rv_res_${r.id}_${idx}`} className="hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white block">{r.studentName}</span>
                          <span className="font-mono text-emerald-400 text-[11px]">{r.studentId}</span>
                          {(r.parentName || r.parentPhone) && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Guardian: {r.parentName || 'Recorded'} {r.parentPhone ? `(${r.parentPhone})` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium">{r.class}</td>
                        <td className="py-3.5 px-4 font-semibold text-indigo-300">
                          {r.subjectName} ({r.subjectCode})
                        </td>
                        <td className="py-3.5 px-4">{r.assessmentTitle}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                          {r.score}
                          <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                            ({Number(r.maxScore) === 60 ? '60' : Number(r.maxScore) === 100 ? '100' : r.maxScore})
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-300 font-semibold">
                          {r.percentage}%
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                            r.grade === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                            r.grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                            r.grade === 'C' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-rose-500/20 text-rose-400'
                          }`}>
                            {r.grade}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {r.session} • {r.term}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 italic max-w-xs truncate">
                          {r.teacherComment || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenCommentsModal(r)}
                              title="Edit official Class Teacher's Comment & Principal's Comment"
                              className="p-1.5 bg-slate-700/70 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(r)}
                              title="Edit this score record"
                              className="p-1.5 bg-slate-700/70 hover:bg-amber-500/20 text-amber-400 rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteScore(r.id, r.studentName)}
                              title="Delete mistakenly entered score"
                              className="p-1.5 bg-slate-700/70 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Score Record Modal */}
      {editingScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-400" />
                  Correct / Edit Assessment Score
                </h3>
                <span className="text-xs text-slate-400">
                  {editingScore.studentName} ({editingScore.studentId}) • {editingScore.class}
                </span>
              </div>
              <button
                onClick={() => setEditingScore(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScoreEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                <select
                  value={editSubjectId}
                  onChange={(e) => setEditSubjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {subjects.map((s, idx) => (
                    <option key={`rv_edit_sub_${s.id}_${s.code || ''}_${idx}`} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Score Obtained</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={editScoreValue}
                    onChange={(e) => setEditScoreValue(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Maximum Score</label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={editMaxScoreValue}
                    onChange={(e) => setEditMaxScoreValue(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Teacher Remarks / Notes</label>
                <input
                  type="text"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="e.g. Corrected score record"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingScore(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  {editSaving ? 'Updating...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Comment Modal for Class Teacher & Principal */}
      {commentModalOpen && commentStudentRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Official Scholar Comments &amp; Endorsement
                  </h3>
                  <p className="text-xs text-slate-400">
                    {commentStudentRecord.studentName} • {commentStudentRecord.studentId} ({commentStudentRecord.class})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-4">
              {/* Class Teacher's Comment Field */}
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-amber-400" />
                    Class Teacher's Comment
                  </label>
                  {!canEditTeacherComment && (
                    <span className="text-[10px] text-slate-500 italic">
                      Class Teacher &amp; Admin only
                    </span>
                  )}
                </div>
                {canEditTeacherComment ? (
                  <textarea
                    rows={3}
                    value={commentDraftTeacher}
                    onChange={(e) => setCommentDraftTeacher(e.target.value)}
                    placeholder="Enter official Class Teacher's evaluation and academic remarks..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl p-2.5 text-xs text-white focus:outline-none transition"
                  />
                ) : (
                  <p className="text-xs text-slate-300 italic p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                    "{commentDraftTeacher || 'No comment authored yet.'}"
                  </p>
                )}
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Designated Class Teacher / Author
                </span>
              </div>

              {/* Principal's Comment Field */}
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-400" />
                    Principal's Comment
                  </label>
                  {!canEditPrincipalComment && (
                    <span className="text-[10px] text-slate-500 italic">
                      Principal &amp; Admin only
                    </span>
                  )}
                </div>
                {canEditPrincipalComment ? (
                  <textarea
                    rows={3}
                    value={commentDraftPrincipal}
                    onChange={(e) => setCommentDraftPrincipal(e.target.value)}
                    placeholder="Enter official School Principal's comment and executive remarks..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl p-2.5 text-xs text-white focus:outline-none transition"
                  />
                ) : (
                  <p className="text-xs text-slate-300 italic p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                    "{commentDraftPrincipal || 'No Principal comment authored yet.'}"
                  </p>
                )}
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Authorizing Authority: <strong>School Principal &amp; School Administration</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCommentModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              {(canEditTeacherComment || canEditPrincipalComment) && (
                <button
                  type="button"
                  onClick={handleSaveComments}
                  disabled={savingComments}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950 transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingComments ? 'Saving...' : 'Save Official Comments'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

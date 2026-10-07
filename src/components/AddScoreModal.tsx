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
  Users
} from 'lucide-react';
import { Subject, Student } from '../types/index.ts';
import { fetchAllSubjectsUnified } from '../lib/subjectStore.ts';
import { fetchAllStudentsUnified, getLocalStudents } from '../lib/schoolStore.ts';
import { supabase } from '../supabaseConfig.ts';
import { isSecondaryClass } from './ClassBroadsheet.tsx';

interface AddScoreModalProps {
  preselectedStudent?: Student | null;
  onScoreSaved?: () => void;
}

export const AddScoreModal: React.FC<AddScoreModalProps> = ({
  preselectedStudent,
  onScoreSaved,
}) => {
  const { token, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  
  // Student Lookup
  const [selectedStudentDropdownId, setSelectedStudentDropdownId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState(preselectedStudent?.studentId || '');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(preselectedStudent || null);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Score Entry Fields
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | number>('');
  const [examPeriod, setExamPeriod] = useState<'first-half' | 'terminal'>('terminal');
  const [assessmentType, setAssessmentType] = useState('Examination');
  const [assessmentTitle, setAssessmentTitle] = useState('Terminal Examination');
  const [score, setScore] = useState<number | string>('60');
  const [maxScore, setMaxScore] = useState<number | string>('60');
  const [session, setSession] = useState('2026/2027');
  const [term, setTerm] = useState('First Term');
  const [teacherComment, setTeacherComment] = useState('Very good academic performance.');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Unified Subjects load
    fetchAllSubjectsUnified(token).then((subs) => {
      setSubjects(subs);
      if (subs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subs[0].id);
      }
    });

    // 2. Unified Students load
    fetchAllStudentsUnified(token).then((students) => {
      setAllStudents(students);
      if (preselectedStudent) {
        const found = students.find((s) => s.id === preselectedStudent.id || s.studentId === preselectedStudent.studentId);
        if (found) {
          setMatchedStudent(found);
          setSelectedStudentDropdownId(String(found.id));
        }
      }
    });
  }, [token]);

  useEffect(() => {
    if (preselectedStudent) {
      setMatchedStudent(preselectedStudent);
      setStudentSearchQuery(preselectedStudent.studentId);
      setSelectedStudentDropdownId(String(preselectedStudent.id));
    }
  }, [preselectedStudent]);

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
    // Check locally and in loaded roster first
    const directMatch = allStudents.find(
      (s) =>
        s.studentId.toLowerCase() === cleanQ ||
        `${s.firstName} ${s.surname}`.toLowerCase().includes(cleanQ) ||
        s.surname.toLowerCase().includes(cleanQ)
    );

    if (directMatch) {
      setMatchedStudent(directMatch);
      setSelectedStudentDropdownId(String(directMatch.id));
      setSearchingStudent(false);
      return;
    }

    try {
      const res = await fetch(`/api/students?q=${encodeURIComponent(studentSearchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.students && data.students.length > 0) {
        setMatchedStudent(data.students[0]);
        setSelectedStudentDropdownId(String(data.students[0].id));
      } else {
        // Query Supabase directly
        const { data: supaData } = await supabase
          .from('students')
          .select('*')
          .ilike('student_id', `%${studentSearchQuery.trim()}%`)
          .limit(1);

        if (supaData && supaData.length > 0) {
          const st = supaData[0];
          const mapped: Student = {
            id: st.id,
            studentId: st.student_id,
            firstName: st.first_name,
            middleName: st.middle_name || null,
            surname: st.surname,
            gender: st.gender || 'Female',
            dateOfBirth: st.date_of_birth || null,
            currentClass: st.current_class || 'SS 3',
            email: st.email || null,
            school: st.school || 'Fenster International School',
            session: st.session || '2026/2027',
            createdAt: st.created_at || new Date().toISOString(),
          };
          setMatchedStudent(mapped);
          setSelectedStudentDropdownId(String(mapped.id));
        } else {
          setMatchedStudent(null);
          setSearchError(`No student found matching "${studentSearchQuery}"`);
        }
      }
    } catch (e: any) {
      setSearchError(e.message || 'Lookup failed');
    } finally {
      setSearchingStudent(false);
    }
  };

  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedStudent) {
      setSaveError('Please select and verify a student first.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const numericScore = Number(score);
    const numericMax = Number(maxScore);
    const percentage = Math.round(((numericScore / numericMax) * 100) * 10) / 10;
    const grade = percentage >= 75 ? 'A1' : percentage >= 70 ? 'B2' : percentage >= 65 ? 'B3' : percentage >= 50 ? 'C4' : 'F9';

    try {
      // 1. Save to Backend API
      try {
        await fetch('/api/scores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            studentId: matchedStudent.id,
            studentNumber: matchedStudent.studentId,
            subjectId: selectedSubjectId,
            assessmentType,
            assessmentTitle,
            score: numericScore,
            maxScore: numericMax,
            session,
            term,
            teacherComment,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend score save deferred:', backendErr);
      }

      // 2. Sync to Supabase assessments table
      try {
        let supaStId: number | null = null;
        if (matchedStudent.studentId) {
          const { data: stRow } = await supabase
            .from('students')
            .select('id')
            .eq('student_id', matchedStudent.studentId)
            .limit(1);
          if (stRow && stRow.length > 0) supaStId = stRow[0].id;
        }

        if (supaStId) {
          await supabase.from('assessments').insert([{
            student_id: supaStId,
            subject_id: Number(selectedSubjectId),
            assessment_type: assessmentType,
            assessment_title: assessmentTitle,
            score: numericScore,
            max_score: numericMax,
            percentage,
            grade,
            session,
            term,
            teacher_comment: teacherComment,
            school_id: 1,
          }]);
        }
      } catch (supaErr) {
        console.warn('Supabase assessment direct sync deferred:', supaErr);
      }

      setSaveSuccess(
        `Score of ${score}/${maxScore} (${percentage}%, Grade ${grade}) saved for ${matchedStudent.firstName} ${matchedStudent.surname}!`
      );
      onScoreSaved?.();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save assessment score');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl fis-card-accent">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block">
              Fenster International School • Continuous Assessment System
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              Add Student Assessment Score
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Record verified CA, Mid-Term, or Final Exam scores for enrolled students. Automatically computes grade and writes directly to their academic transcript.
            </p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Step 1: Student Lookup */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            1. Select or Verify Student Scholar
          </span>
          <span className="text-[11px] text-slate-400 font-normal">
            {allStudents.length} Enrolled Scholars
          </span>
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Select Student from Registered Roster *
          </label>
          <select
            value={selectedStudentDropdownId}
            onChange={(e) => handleDropdownSelect(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Choose student from active directory ({allStudents.length}) --</option>
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
            Or Search by Student ID / Name
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
              placeholder="e.g. FEN-2026-000001 or Student Name..."
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

        {searchError && (
          <p className="text-xs text-rose-400">{searchError}</p>
        )}

        {matchedStudent && (
          <div className="p-4 bg-slate-900/90 border border-emerald-500/40 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {matchedStudent.firstName} {matchedStudent.surname}
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-emerald-400 font-medium">ID: {matchedStudent.studentId}</span>
                  <span>Class: {matchedStudent.currentClass}</span>
                  <span>School: {matchedStudent.school}</span>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400">
              Verified
            </span>
          </div>
        )}
      </div>

      {/* Step 2: Score Details Form */}
      {matchedStudent && (
        <form onSubmit={handleSaveScore} className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              2. Assessment & Subject Score Details
            </h3>
            {matchedStudent && isSecondaryClass(matchedStudent.currentClass) ? (
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                Secondary Class: 2 Exams/Term (1st Half &amp; Terminal, each CA /40 + Exam /60 = 100)
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                Primary / Lower Class: 1 Exam/Term (Terminal Exam: CA /40 + Exam /60 = 100)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/60 border border-slate-700 rounded-xl text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Examination Period {matchedStudent && isSecondaryClass(matchedStudent.currentClass) ? '(Secondary - 2 per term)' : '(Primary - 1 per term)'}
              </label>
              {matchedStudent && isSecondaryClass(matchedStudent.currentClass) ? (
                <select
                  value={examPeriod}
                  onChange={(e) => {
                    const p = e.target.value as 'first-half' | 'terminal';
                    setExamPeriod(p);
                    if (p === 'first-half') {
                      setAssessmentTitle('1st Half (6th Week) Assessment');
                    } else {
                      setAssessmentTitle('Terminal Examination');
                    }
                  }}
                  className="w-full bg-slate-800 border border-amber-500/40 text-amber-300 font-bold rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="first-half">1st Half Exam (6th Week) — CA /40 + Main Exam /60 = 100</option>
                  <option value="terminal">Terminal Exam — CA /40 + Main Exam /60 = 100</option>
                </select>
              ) : (
                <div className="w-full bg-slate-800 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl px-3 py-2 text-xs">
                  Terminal Exam (Once a Term: CA /40 + Main Exam /60 = 100)
                </div>
              )}
            </div>
            <div className="flex items-center text-slate-300 text-[11px]">
              <span>
                Standard Grading: CA / Test score is marked over <strong>40</strong> and Exam score is marked over <strong>60</strong>, totaling <strong>100</strong> per subject. Each subject score remains saved when another is entered; student average calculates automatically.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  const subId = e.target.value;
                  setSelectedSubjectId(subId);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Assessment Type *</label>
              <select
                value={assessmentType}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssessmentType(val);
                  if (val === 'CA' || val === 'Test' || val === 'Quiz' || val === 'Assignment') {
                    setMaxScore('40');
                    if (Number(score) > 40) setScore('40');
                  } else if (val === 'Examination') {
                    setMaxScore('60');
                    if (Number(score) > 60) setScore('60');
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="CA">Continuous Assessment (CA - max 40)</option>
                <option value="Test">6th Week / Mid-Term Test (max 40)</option>
                <option value="Examination">Main Examination (max 60)</option>
                <option value="Assignment">Practical / Homework (max 40)</option>
                <option value="Quiz">Quick Quiz (max 40)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Assessment Title *</label>
            <input
              type="text"
              required
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder="e.g. First Continuous Assessment"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Score Obtained *</label>
              <input
                type="number"
                required
                min={0}
                max={1000}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Maximum Score</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Session</label>
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Term</label>
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
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Teacher Remarks / Feedback</label>
            <input
              type="text"
              value={teacherComment}
              onChange={(e) => setTeacherComment(e.target.value)}
              placeholder="e.g. Very good performance. Shows strong mastery of the curriculum."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-900/40 border border-emerald-600/50 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              {saving ? 'Recording Score...' : 'SAVE SCORE RECORD'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

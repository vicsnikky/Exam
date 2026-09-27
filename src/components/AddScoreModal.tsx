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
  UserCheck
} from 'lucide-react';
import { Subject, Student } from '../types/index.ts';

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
  
  // Student Lookup
  const [studentSearchQuery, setStudentSearchQuery] = useState(preselectedStudent?.studentId || '');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(preselectedStudent || null);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Score Entry Fields
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | number>('');
  const [assessmentType, setAssessmentType] = useState('CA');
  const [assessmentTitle, setAssessmentTitle] = useState('Continuous Assessment 1');
  const [score, setScore] = useState<number | string>('78');
  const [maxScore, setMaxScore] = useState<number | string>('100');
  const [session, setSession] = useState('2026/2027');
  const [term, setTerm] = useState('First Term');
  const [teacherComment, setTeacherComment] = useState('Very good academic performance.');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/subjects', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.subjects && d.subjects.length > 0) {
          setSubjects(d.subjects);
          setSelectedSubjectId(d.subjects[0].id);
        }
      });
  }, [token]);

  useEffect(() => {
    if (preselectedStudent) {
      setMatchedStudent(preselectedStudent);
      setStudentSearchQuery(preselectedStudent.studentId);
    }
  }, [preselectedStudent]);

  const handleLookupStudent = async () => {
    if (!studentSearchQuery.trim()) return;
    setSearchingStudent(true);
    setSearchError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/students?q=${encodeURIComponent(studentSearchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.students && data.students.length > 0) {
        setMatchedStudent(data.students[0]);
      } else {
        setMatchedStudent(null);
        setSearchError(`No student found matching "${studentSearchQuery}"`);
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
      setSaveError('Please search and verify a student first.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: matchedStudent.id,
          subjectId: selectedSubjectId,
          assessmentType,
          assessmentTitle,
          score: Number(score),
          maxScore: Number(maxScore),
          session,
          term,
          teacherComment,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save score');

      setSaveSuccess(
        `Score of ${score}/${maxScore} (${data.assessment?.percentage}%, Grade ${data.assessment?.grade}) saved for ${matchedStudent.firstName} ${matchedStudent.surname}!`
      );
      onScoreSaved?.();
    } catch (err: any) {
      setSaveError(err.message);
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
              Federal International School • Continuous Assessment System
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
          <span>1. Verify Existing Student</span>
          <span className="text-[11px] text-slate-400 font-normal">Search by ID or Name</span>
        </h3>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookupStudent())}
              placeholder="e.g. FIS-2026-000001 or Johnson..."
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
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-700">
            2. Assessment & Subject Score Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject *</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
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
                onChange={(e) => setAssessmentType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="CA">Continuous Assessment (CA)</option>
                <option value="Test">Mid-Term Test</option>
                <option value="Examination">Terminal Examination</option>
                <option value="Assignment">Practical / Homework</option>
                <option value="Quiz">Quick Quiz</option>
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

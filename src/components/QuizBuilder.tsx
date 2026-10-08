import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  Layers,
  Search,
  Plus,
  CheckCircle,
  Clock,
  Send,
  HelpCircle,
  Loader2,
  Users,
  AlertCircle
} from 'lucide-react';
import { Subject, Question, Student } from '../types/index.ts';
import { fetchAllSubjectsUnified } from '../lib/subjectStore.ts';
import { fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import { SCHOOL_CLASSES } from '../constants/classes.ts';

interface QuizBuilderProps {
  onQuizCreated?: () => void;
}

export const QuizBuilder: React.FC<QuizBuilderProps> = ({ onQuizCreated }) => {
  const { token, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form parameters
  const [title, setTitle] = useState('Photosynthesis & Cellular Energy Test');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | string>('');
  const [topic, setTopic] = useState('Plant Biology');
  const [targetClass, setTargetClass] = useState('SS 2');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [instructions, setInstructions] = useState('Attempt all multiple choice questions. Each question carries equal marks.');
  const [passMark, setPassMark] = useState(50);
  const [totalMarks, setTotalMarks] = useState(100);

  // Assignment selection
  const [assignmentType, setAssignmentType] = useState<'class' | 'student'>('class');
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);

  // Load initial subjects & students
  useEffect(() => {
    fetch('/api/subjects', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((text) => {
        try {
          const d = JSON.parse(text);
          if (d.subjects && d.subjects.length > 0) {
            setSubjects(d.subjects);
            setSelectedSubjectId(d.subjects[0].id);
          }
        } catch (_) {}
      })
      .catch(() => {});

    fetch('/api/students?limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((text) => {
        try {
          const d = JSON.parse(text);
          setStudents(d.students || []);
        } catch (_) {}
      })
      .catch(() => {});
  }, [token]);

  // Load question bank when subject changes
  const loadQuestions = async (subjId: string | number) => {
    if (!subjId) return;
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/questions?subjectId=${subjId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch (_) {}
      setQuestions(data.questions || []);
      // Auto select all available questions for this quiz
      setSelectedQuestionIds((data.questions || []).map((q: any) => q.id));
    } catch (e) {
      console.error('Questions fetch error:', e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (selectedSubjectId) {
      loadQuestions(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  const toggleQuestion = (id: number) => {
    if (selectedQuestionIds.includes(id)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((qId) => qId !== id));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, id]);
    }
  };

  const toggleStudent = (id: number) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sId) => sId !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) {
      setError('Please select at least 1 question for the quiz.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          subjectId: selectedSubjectId,
          topic,
          targetClass,
          durationMinutes,
          instructions,
          passMark,
          totalMarks,
          questionIds: selectedQuestionIds,
          assignmentType,
          assignedStudents: selectedStudentIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create quiz');

      setSuccessMsg(`Quiz "${title}" created and assigned successfully! Students can now access and take the test.`);
      onQuizCreated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl fis-card-accent">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
            <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block">
              Fenster International School • Examination Board
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Quiz & Assessment Builder
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Build structured online tests, set exact timers, select questions from the AI question bank, and publish to entire classes or assigned students.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleCreateQuiz} className="space-y-6">
        {/* Basic Details */}
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-700">
            1. Quiz Details & Duration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Quiz Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mathematics Mid-Term Test"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
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
              <label className="block text-xs font-medium text-slate-300 mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quadratic Equations"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Class *</label>
              <select
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Classes</option>
                {SCHOOL_CLASSES.map((cName) => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Exam Duration (Minutes) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={300}
                  required
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">mins</span>
              </div>
              <div className="flex gap-1.5 mt-1.5">
                {[10, 15, 20, 30, 45, 60].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDurationMinutes(preset)}
                    className={`px-1.5 py-0.5 text-[10px] rounded border transition cursor-pointer ${
                      durationMinutes === preset
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {preset}m
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Total Marks</label>
              <input
                type="number"
                min={10}
                max={200}
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Pass Mark (%)</label>
              <input
                type="number"
                min={30}
                max={90}
                value={passMark}
                onChange={(e) => setPassMark(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Instructions for Students</label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Question Bank Selection */}
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-700">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                2. Select Questions from Bank ({selectedQuestionIds.length} Selected)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Questions created or AI-generated for this subject are listed below.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedQuestionIds(questions.map((q: any) => q.id))}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuestionIds([])}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {loadingQuestions ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Loading questions...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-900/60 rounded-xl">
              <p className="text-sm text-slate-300 font-medium">No questions found in bank for this subject.</p>
              <p className="text-xs mt-1">Use the <strong>Question Generator</strong> tab to generate questions with AI first.</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {questions.map((q: any, i) => {
                const isSelected = selectedQuestionIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleQuestion(q.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-1 accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1 text-xs">
                      <span className="font-semibold block text-slate-200">
                        {i + 1}. {q.questionText}
                      </span>
                      <div className="grid grid-cols-2 gap-2 mt-1.5 text-slate-400">
                        <span>A: {q.optionA}</span>
                        <span>B: {q.optionB}</span>
                        <span>C: {q.optionC}</span>
                        <span>D: {q.optionD}</span>
                      </div>
                      <span className="inline-block mt-1 text-[11px] text-emerald-400 font-medium">
                        Correct Answer: Option {q.correctAnswer}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment Target */}
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-700">
            3. Assignment Target
          </h3>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="radio"
                name="assignTarget"
                checked={assignmentType === 'class'}
                onChange={() => setAssignmentType('class')}
                className="accent-indigo-500"
              />
              Entire Class ({targetClass})
            </label>
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="radio"
                name="assignTarget"
                checked={assignmentType === 'student'}
                onChange={() => setAssignmentType('student')}
                className="accent-indigo-500"
              />
              Specific Student(s)
            </label>
          </div>

          {assignmentType === 'student' && (
            <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-900/80 p-3 rounded-xl border border-slate-700">
              {students.map((st) => (
                <label
                  key={st.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/80 text-xs text-slate-300 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(st.id)}
                      onChange={() => toggleStudent(st.id)}
                      className="accent-indigo-500"
                    />
                    <span>{st.firstName} {st.surname} ({st.currentClass})</span>
                  </div>
                  <span className="font-mono text-emerald-400">{st.studentId}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-900/40 border border-emerald-600/50 cursor-pointer disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Send className="w-4 h-4 text-amber-400" />}
            Publish & Assign Exam
          </button>
        </div>
      </form>
    </div>
  );
};

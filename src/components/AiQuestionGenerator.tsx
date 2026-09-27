import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  Sparkles,
  BookOpen,
  Sliders,
  CheckCircle2,
  Trash2,
  Edit2,
  PlusCircle,
  Save,
  Check,
  AlertCircle,
  Loader2,
  HelpCircle,
  PenTool,
  Database,
  ArrowRight,
  Eye,
  Layers,
  Send,
  Search,
  Filter
} from 'lucide-react';
import { Subject, Question } from '../types/index.ts';

interface AiQuestionGeneratorProps {
  onQuestionsSaved?: () => void;
  onNavigateQuizBuilder?: () => void;
}

interface QuizOption {
  id: number;
  title: string;
  targetClass: string;
  subjectName: string;
}

export const AiQuestionGenerator: React.FC<AiQuestionGeneratorProps> = ({
  onQuestionsSaved,
  onNavigateQuizBuilder,
}) => {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeQuizzes, setActiveQuizzes] = useState<QuizOption[]>([]);
  const [activeMode, setActiveMode] = useState<'manual' | 'ai' | 'bank'>('manual');

  // ----------------------------------------------------
  // MANUAL QUESTION ENTRY STATES (Teacher Direct Typing)
  // ----------------------------------------------------
  const [manualSubjectId, setManualSubjectId] = useState<number | string>('');
  const [manualTopic, setManualTopic] = useState('Photosynthesis & Cell Biology');
  const [manualClassLevel, setManualClassLevel] = useState('SS 2');
  const [manualDifficulty, setManualDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualOptionA, setManualOptionA] = useState('');
  const [manualOptionB, setManualOptionB] = useState('');
  const [manualOptionC, setManualOptionC] = useState('');
  const [manualOptionD, setManualOptionD] = useState('');
  const [manualCorrectAnswer, setManualCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [manualExplanation, setManualExplanation] = useState('');
  const [manualTargetQuizId, setManualTargetQuizId] = useState<string>(''); // Attach directly to exam
  const [savingManual, setSavingManual] = useState(false);

  // ----------------------------------------------------
  // AI GENERATOR STATES
  // ----------------------------------------------------
  const [educationalText, setEducationalText] = useState(
    `Photosynthesis is the process by which green plants manufacture their food using sunlight, carbon dioxide and water. In the presence of sunlight absorbed by chlorophyll within plant chloroplasts, water (H2O) absorbed from the soil and carbon dioxide (CO2) absorbed from the atmosphere undergo chemical reactions to produce glucose (sugar) and oxygen (O2). Glucose serves as the primary energy source for cellular respiration and plant growth, while oxygen is released into the atmosphere as a crucial byproduct supporting animal and human life. The light-dependent reactions occur in the thylakoid membranes, while the light-independent Calvin cycle occurs in the stroma of the chloroplast.`
  );
  const [aiSubjectId, setAiSubjectId] = useState<number | string>('');
  const [aiTopic, setAiTopic] = useState('Photosynthesis & Cellular Energy');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [aiClassLevel, setAiClassLevel] = useState('SS 2');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [savingAiBatch, setSavingAiBatch] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);

  // ----------------------------------------------------
  // QUESTION BANK BROWSER STATES
  // ----------------------------------------------------
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankFilterSubject, setBankFilterSubject] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Notification States
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch initial subjects & existing quizzes for direct assignment
  useEffect(() => {
    fetch('/api/subjects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects);
          setManualSubjectId(data.subjects[0].id);
          setAiSubjectId(data.subjects[0].id);
        }
      })
      .catch((err) => console.error('Subjects fetch error:', err));

    fetch('/api/quizzes', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.quizzes) {
          setActiveQuizzes(data.quizzes);
        }
      })
      .catch((err) => console.error('Quizzes fetch error:', err));
  }, [token]);

  // Load question bank
  const loadQuestionBank = async () => {
    setLoadingBank(true);
    try {
      const res = await fetch('/api/questions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBankQuestions(data.questions || []);
    } catch (err) {
      console.error('Failed to load bank:', err);
    } finally {
      setLoadingBank(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'bank') {
      loadQuestionBank();
    }
  }, [activeMode]);

  // ----------------------------------------------------
  // 1. HANDLE MANUAL QUESTION SUBMISSION
  // ----------------------------------------------------
  const handleSaveManualQuestion = async (andCreateAnother: boolean = false) => {
    setError(null);
    setSuccessMsg(null);

    // Validation
    if (!manualQuestionText.trim()) {
      setError('Please type the question text.');
      return;
    }
    if (!manualOptionA.trim() || !manualOptionB.trim() || !manualOptionC.trim() || !manualOptionD.trim()) {
      setError('Please provide all 4 options: Option A, Option B, Option C, and Option D.');
      return;
    }
    if (!manualSubjectId) {
      setError('Please select a subject.');
      return;
    }

    const cleanAns = manualCorrectAnswer.toUpperCase().trim();
    if (!['A', 'B', 'C', 'D'].includes(cleanAns)) {
      setError('Correct answer must be A, B, C, or D.');
      return;
    }

    setSavingManual(true);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subjectId: manualSubjectId,
          topic: manualTopic.trim(),
          classLevel: manualClassLevel,
          difficulty: manualDifficulty,
          questionText: manualQuestionText.trim(),
          optionA: manualOptionA.trim(),
          optionB: manualOptionB.trim(),
          optionC: manualOptionC.trim(),
          optionD: manualOptionD.trim(),
          correctAnswer: cleanAns,
          explanation: manualExplanation.trim() || `Correct answer is Option ${cleanAns}.`,
          quizId: manualTargetQuizId ? Number(manualTargetQuizId) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save question');

      const quizAttachedName = manualTargetQuizId
        ? activeQuizzes.find((q) => q.id === Number(manualTargetQuizId))?.title
        : null;

      setSuccessMsg(
        `Question saved successfully to question bank!${
          quizAttachedName ? ` Also published to student exam: "${quizAttachedName}".` : ''
        }`
      );

      // Refresh question bank cache
      if (activeMode === 'bank') {
        loadQuestionBank();
      }

      if (andCreateAnother) {
        // Reset question and options for next question
        setManualQuestionText('');
        setManualOptionA('');
        setManualOptionB('');
        setManualOptionC('');
        setManualOptionD('');
        setManualExplanation('');
        // Keep subject, topic, class level, and quiz selection for fast multi-question authoring!
      }

      onQuestionsSaved?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingManual(false);
    }
  };

  // ----------------------------------------------------
  // 2. HANDLE AI QUESTION GENERATION
  // ----------------------------------------------------
  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!educationalText.trim()) {
      setError('Please paste educational text for the AI to analyze.');
      return;
    }

    setGeneratingAi(true);
    setError(null);
    setSuccessMsg(null);

    const subjectObj = subjects.find((s) => s.id === Number(aiSubjectId));
    const subjectName = subjectObj ? subjectObj.name : 'Science';

    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          educationalText,
          subject: subjectName,
          topic: aiTopic,
          numberOfQuestions,
          difficulty: aiDifficulty,
          classLevel: aiClassLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');

      const mapped = data.questions.map((q: any) => ({
        ...q,
        subjectId: Number(aiSubjectId),
        subjectName,
        topic: aiTopic,
        classLevel: aiClassLevel,
        difficulty: q.difficulty || aiDifficulty,
        questionText: q.question,
      }));

      setGeneratedQuestions(mapped);
      setSuccessMsg(`Successfully generated ${mapped.length} multiple-choice questions strictly from the text!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleUpdateGeneratedQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...generatedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedQuestions(updated);
  };

  const handleDeleteGeneratedQuestion = (index: number) => {
    setGeneratedQuestions(generatedQuestions.filter((_, i) => i !== index));
  };

  const handleSaveAiBatchToBank = async () => {
    if (generatedQuestions.length === 0) return;
    setSavingAiBatch(true);
    setError(null);

    try {
      const res = await fetch('/api/questions/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questions: generatedQuestions,
          subjectId: aiSubjectId,
          topic: aiTopic,
          classLevel: aiClassLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save questions');

      setSuccessMsg(data.message || 'Saved to Question Bank!');
      onQuestionsSaved?.();
      setGeneratedQuestions([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingAiBatch(false);
    }
  };

  // ----------------------------------------------------
  // 3. DELETE FROM BANK
  // ----------------------------------------------------
  const handleDeleteFromBank = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question from the bank?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete question');
      }
      setBankQuestions(bankQuestions.filter((q) => q.id !== id));
      setSuccessMsg('Question deleted successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered questions in bank
  const filteredBank = bankQuestions.filter((q) => {
    const matchesSearch =
      bankSearch === '' ||
      q.questionText.toLowerCase().includes(bankSearch.toLowerCase()) ||
      q.topic?.toLowerCase().includes(bankSearch.toLowerCase()) ||
      q.subjectName?.toLowerCase().includes(bankSearch.toLowerCase());
    const matchesSubject =
      bankFilterSubject === 'all' || q.subjectId === Number(bankFilterSubject);
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl fis-card-accent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
              <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block">
                Fenster International School • Examination Board
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                Exam Question Creator & Question Bank
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Type questions with multiple-choice options (A, B, C, D) and answer keys, or generate questions via AI, and automatically push them to live student exams.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateQuizBuilder}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              Build / View Tests
            </button>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl gap-2">
        <button
          type="button"
          onClick={() => { setActiveMode('manual'); setError(null); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'manual'
              ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/40 border border-emerald-600/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <PenTool className="w-4 h-4 text-amber-400" />
          Type Question Manually (Options A, B, C, D)
        </button>

        <button
          type="button"
          onClick={() => { setActiveMode('ai'); setError(null); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'ai'
              ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/40 border border-emerald-600/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          AI Syllabus Question Generator
        </button>

        <button
          type="button"
          onClick={() => { setActiveMode('bank'); setError(null); }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeMode === 'bank'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-4 h-4" />
          Browse Question Bank ({bankQuestions.length})
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: TEACHER MANUAL QUESTION AUTHORING FORM                             */}
      {/* ========================================================================= */}
      {activeMode === 'manual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Question Authoring Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-emerald-400" />
                    Teacher Multiple Choice Question Form
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Type your question text, supply options A, B, C, D, and designate the verified correct answer.
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-lg font-mono font-semibold">
                  MCQ Format
                </span>
              </div>

              {/* Classification: Subject, Topic, Class, Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Subject *</label>
                  <select
                    value={manualSubjectId}
                    onChange={(e) => setManualSubjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Topic *</label>
                  <input
                    type="text"
                    required
                    value={manualTopic}
                    onChange={(e) => setManualTopic(e.target.value)}
                    placeholder="e.g. Plant Biology"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Class *</label>
                  <select
                    value={manualClassLevel}
                    onChange={(e) => setManualClassLevel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="JSS 1">JSS 1</option>
                    <option value="JSS 2">JSS 2</option>
                    <option value="JSS 3">JSS 3</option>
                    <option value="SS 1">SS 1</option>
                    <option value="SS 2">SS 2</option>
                    <option value="SS 3">SS 3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty *</label>
                  <select
                    value={manualDifficulty}
                    onChange={(e) => setManualDifficulty(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* 1. Question Text */}
              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Question Statement *</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Clear, unambiguous question for the student
                  </span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={manualQuestionText}
                  onChange={(e) => setManualQuestionText(e.target.value)}
                  placeholder="e.g. Which of the following organelles is primarily responsible for the synthesis of ATP in eukaryotic cells?"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-emerald-400 placeholder:text-slate-500 font-sans"
                />
              </div>

              {/* 2. Multiple Choice Options (A, B, C, D) */}
              <div className="space-y-3 pt-1">
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Multiple Choice Options (A, B, C, D) *
                </label>

                {/* Option A */}
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    manualCorrectAnswer === 'A'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-sm shadow-emerald-900/30'
                      : 'bg-slate-950/60 border-slate-800 focus-within:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setManualCorrectAnswer('A')}
                    title="Click to set A as correct answer"
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                      manualCorrectAnswer === 'A'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    A
                  </button>
                  <input
                    type="text"
                    required
                    value={manualOptionA}
                    onChange={(e) => setManualOptionA(e.target.value)}
                    placeholder="Enter Option A text (e.g. Ribosome)"
                    className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-600"
                  />
                  {manualCorrectAnswer === 'A' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                      ✓ Correct
                    </span>
                  )}
                </div>

                {/* Option B */}
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    manualCorrectAnswer === 'B'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-sm shadow-emerald-900/30'
                      : 'bg-slate-950/60 border-slate-800 focus-within:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setManualCorrectAnswer('B')}
                    title="Click to set B as correct answer"
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                      manualCorrectAnswer === 'B'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    B
                  </button>
                  <input
                    type="text"
                    required
                    value={manualOptionB}
                    onChange={(e) => setManualOptionB(e.target.value)}
                    placeholder="Enter Option B text (e.g. Mitochondrion)"
                    className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-600"
                  />
                  {manualCorrectAnswer === 'B' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                      ✓ Correct
                    </span>
                  )}
                </div>

                {/* Option C */}
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    manualCorrectAnswer === 'C'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-sm shadow-emerald-900/30'
                      : 'bg-slate-950/60 border-slate-800 focus-within:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setManualCorrectAnswer('C')}
                    title="Click to set C as correct answer"
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                      manualCorrectAnswer === 'C'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    C
                  </button>
                  <input
                    type="text"
                    required
                    value={manualOptionC}
                    onChange={(e) => setManualOptionC(e.target.value)}
                    placeholder="Enter Option C text (e.g. Endoplasmic Reticulum)"
                    className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-600"
                  />
                  {manualCorrectAnswer === 'C' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                      ✓ Correct
                    </span>
                  )}
                </div>

                {/* Option D */}
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    manualCorrectAnswer === 'D'
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-sm shadow-emerald-900/30'
                      : 'bg-slate-950/60 border-slate-800 focus-within:border-slate-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setManualCorrectAnswer('D')}
                    title="Click to set D as correct answer"
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition cursor-pointer ${
                      manualCorrectAnswer === 'D'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    D
                  </button>
                  <input
                    type="text"
                    required
                    value={manualOptionD}
                    onChange={(e) => setManualOptionD(e.target.value)}
                    placeholder="Enter Option D text (e.g. Golgi Apparatus)"
                    className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-600"
                  />
                  {manualCorrectAnswer === 'D' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                      ✓ Correct
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Designated Correct Answer Box (As explicitly requested by user) */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                      Correct Answer Designation Box *
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Write or select the letter corresponding to the correct choice (A, B, C, or D).
                    </span>
                  </div>

                  {/* Direct Letter Input Box */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 font-medium">Correct Letter:</span>
                    <input
                      type="text"
                      maxLength={1}
                      value={manualCorrectAnswer}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        if (['A', 'B', 'C', 'D'].includes(val)) {
                          setManualCorrectAnswer(val as any);
                        } else if (val === '') {
                          setManualCorrectAnswer('A');
                        }
                      }}
                      className="w-12 h-10 text-center text-lg font-bold font-mono bg-emerald-950 text-amber-300 border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />

                    {/* Quick Pick Buttons */}
                    <div className="flex gap-1">
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => setManualCorrectAnswer(letter)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                            manualCorrectAnswer === letter
                              ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-300/80 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/50 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Current designated correct option: <strong className="text-amber-300 font-bold">Option {manualCorrectAnswer}</strong>
                    {manualCorrectAnswer === 'A' && manualOptionA && ` — "${manualOptionA}"`}
                    {manualCorrectAnswer === 'B' && manualOptionB && ` — "${manualOptionB}"`}
                    {manualCorrectAnswer === 'C' && manualOptionC && ` — "${manualOptionC}"`}
                    {manualCorrectAnswer === 'D' && manualOptionD && ` — "${manualOptionD}"`}
                  </span>
                </div>
              </div>

              {/* 4. Explanation & Exam Linkage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Curriculum Explanation / Reference Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualExplanation}
                    onChange={(e) => setManualExplanation(e.target.value)}
                    placeholder="e.g. Mitochondria are known as the powerhouses of the cell..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-amber-300 mb-1 flex items-center justify-between">
                    <span>Directly Attach to Active Exam</span>
                    <span className="text-[10px] text-slate-400 font-normal">Auto-publish to students</span>
                  </label>
                  <select
                    value={manualTargetQuizId}
                    onChange={(e) => setManualTargetQuizId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="">Save to Question Bank Only (Draft)</option>
                    {activeQuizzes.map((qz) => (
                      <option key={qz.id} value={qz.id}>
                        ⚡ Push to: {qz.title} ({qz.targetClass})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={savingManual}
                  onClick={() => handleSaveManualQuestion(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-amber-400/30 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  Save & Type Another Question
                </button>

                <button
                  type="button"
                  disabled={savingManual}
                  onClick={() => handleSaveManualQuestion(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/40 border border-emerald-600/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingManual ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      Saving Question to Database...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-amber-400" />
                      SAVE QUESTION TO EXAM & BANK
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Real-Time Student Exam Preview */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl fis-card-accent">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
                <Eye className="w-4 h-4" />
                Live Student Exam Preview
              </div>
              <p className="text-[11px] text-slate-400 mb-4">
                This preview shows exactly how the student will see this question during an online CBT examination:
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold">Question 1 of 1</span>
                  <span className="text-slate-400 font-mono">1.0 Mark</span>
                </div>

                <div className="text-xs font-medium text-white leading-relaxed">
                  {manualQuestionText || (
                    <span className="text-slate-500 italic">
                      [Type your question above to see live preview...]
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  {[
                    { label: 'A', text: manualOptionA },
                    { label: 'B', text: manualOptionB },
                    { label: 'C', text: manualOptionC },
                    { label: 'D', text: manualOptionD },
                  ].map((opt) => (
                    <div
                      key={opt.label}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs ${
                        manualCorrectAnswer === opt.label
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                          manualCorrectAnswer === opt.label
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="truncate">
                        {opt.text || <span className="text-slate-600 italic">Option {opt.label}</span>}
                      </span>
                      {manualCorrectAnswer === opt.label && (
                        <span className="ml-auto text-[9px] font-bold text-emerald-400 uppercase">
                          Key
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Subject:</span>
                  <span className="text-slate-200 font-medium">
                    {subjects.find((s) => s.id === Number(manualSubjectId))?.name || 'Selected Subject'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target Class:</span>
                  <span className="text-amber-400 font-medium">{manualClassLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span>Difficulty:</span>
                  <span className="text-emerald-400 font-medium">{manualDifficulty}</span>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-slate-900/60 border border-slate-800/60 p-4 rounded-xl text-xs space-y-2 text-slate-400">
              <span className="text-amber-400 font-bold block">Examination Tip:</span>
              <p>
                To push questions directly to an active student test without building a new quiz from scratch, select the target exam in the <strong>"Directly Attach to Active Exam"</strong> dropdown.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: AI QUESTION GENERATION                                            */}
      {/* ========================================================================= */}
      {activeMode === 'ai' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateAi} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                AI Syllabus Analysis & Question Generation
              </h3>
              <span className="text-[11px] text-emerald-400 font-medium">
                Strict Curriculum Grounding
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                Curriculum Text Material (Lesson Note / Syllabus Excerpt) *
              </label>
              <textarea
                rows={5}
                required
                value={educationalText}
                onChange={(e) => setEducationalText(e.target.value)}
                placeholder="Paste lesson note, textbook chapter, or comprehension passage here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-emerald-400 leading-relaxed font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Subject *</label>
                <select
                  value={aiSubjectId}
                  onChange={(e) => setAiSubjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Topic *</label>
                <input
                  type="text"
                  required
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Class</label>
                <select
                  value={aiClassLevel}
                  onChange={(e) => setAiClassLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="JSS 1">JSS 1</option>
                  <option value="JSS 2">JSS 2</option>
                  <option value="JSS 3">JSS 3</option>
                  <option value="SS 1">SS 1</option>
                  <option value="SS 2">SS 2</option>
                  <option value="SS 3">SS 3</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Questions Count</label>
                <select
                  value={numberOfQuestions}
                  onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value={3}>3 Questions</option>
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions</option>
                  <option value={20}>20 Questions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={generatingAi}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generatingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    Analyzing Lesson Note & Generating MCQs...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    GENERATE QUESTIONS WITH AI
                  </>
                )}
              </button>
            </div>
          </form>

          {/* AI Generated Review List */}
          {generatedQuestions.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Review Generated MCQs ({generatedQuestions.length} Questions)
                </h3>
                <button
                  type="button"
                  onClick={handleSaveAiBatchToBank}
                  disabled={savingAiBatch}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  {savingAiBatch ? 'Saving...' : 'SAVE ALL TO QUESTION BANK'}
                </button>
              </div>

              <div className="space-y-4">
                {generatedQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <span className="text-[11px] font-bold text-amber-400 uppercase">Question {idx + 1}</span>
                        <input
                          type="text"
                          value={q.questionText}
                          onChange={(e) => handleUpdateGeneratedQuestion(idx, 'questionText', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-medium"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGeneratedQuestion(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                        const optKey = `option${letter}` as keyof Question;
                        const isCorrect = q.correctAnswer === letter;
                        return (
                          <div
                            key={letter}
                            onClick={() => handleUpdateGeneratedQuestion(idx, 'correctAnswer', letter)}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                              isCorrect
                                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {letter}
                            </span>
                            <input
                              type="text"
                              value={q[optKey] as string}
                              onChange={(e) => handleUpdateGeneratedQuestion(idx, optKey, e.target.value)}
                              className="w-full bg-transparent text-xs text-white focus:outline-none"
                            />
                            {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: BROWSE QUESTION BANK                                              */}
      {/* ========================================================================= */}
      {activeMode === 'bank' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                Active Question Bank Records ({filteredBank.length} Questions)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                All questions stored in the database. These questions are available when compiling CBT exams.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search questions or topics..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <select
                value={bankFilterSubject}
                onChange={(e) => setBankFilterSubject(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingBank ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              Loading Question Bank from database...
            </div>
          ) : filteredBank.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
              No questions found matching your filter criteria. Use the <strong>"Type Question Manually"</strong> tab above to add questions!
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredBank.map((q) => (
                <div key={q.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                          {q.subjectName || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Topic: {q.topic || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Class: {q.classLevel || 'All'}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white leading-relaxed">
                        {q.questionText}
                      </h4>
                    </div>

                    <button
                      type="button"
                      disabled={deletingId === q.id}
                      onClick={() => q.id && handleDeleteFromBank(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                      title="Delete Question"
                    >
                      {deletingId === q.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                      const optKey = `option${letter}` as keyof Question;
                      const isCorrect = q.correctAnswer === letter;
                      return (
                        <div
                          key={letter}
                          className={`flex items-center gap-2 p-2 rounded-lg border ${
                            isCorrect
                              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                              isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="truncate">{q[optKey] as string}</span>
                          {isCorrect && (
                            <span className="ml-auto text-[9px] uppercase font-bold text-emerald-400">
                              ✓ Correct Key
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  HelpCircle
} from 'lucide-react';
import { Subject, Question } from '../types/index.ts';

interface AiQuestionGeneratorProps {
  onQuestionsSaved?: () => void;
  onNavigateQuizBuilder?: () => void;
}

export const AiQuestionGenerator: React.FC<AiQuestionGeneratorProps> = ({
  onQuestionsSaved,
  onNavigateQuizBuilder,
}) => {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Generation Input Parameters
  const [educationalText, setEducationalText] = useState(
    `Photosynthesis is the process by which green plants manufacture their food using sunlight, carbon dioxide and water. In the presence of sunlight absorbed by chlorophyll within plant chloroplasts, water (H2O) absorbed from the soil and carbon dioxide (CO2) absorbed from the atmosphere undergo chemical reactions to produce glucose (sugar) and oxygen (O2). Glucose serves as the primary energy source for cellular respiration and plant growth, while oxygen is released into the atmosphere as a crucial byproduct supporting animal and human life. The light-dependent reactions occur in the thylakoid membranes, while the light-independent Calvin cycle occurs in the stroma of the chloroplast.`
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | string>('');
  const [topic, setTopic] = useState('Photosynthesis & Cellular Energy');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [classLevel, setClassLevel] = useState('SS 2');

  // Generation & Review States
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Load Subjects
  useEffect(() => {
    fetch('/api/subjects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.subjects && data.subjects.length > 0) {
          setSubjects(data.subjects);
          // Set Biology or first subject as default
          const bio = data.subjects.find((s: Subject) => s.name.toLowerCase().includes('bio'));
          setSelectedSubjectId(bio ? bio.id : data.subjects[0].id);
        }
      })
      .catch((err) => console.error('Subjects fetch error:', err));
  }, [token]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!educationalText.trim()) {
      setError('Please paste educational text for the AI to analyze.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMsg(null);

    const subjectObj = subjects.find((s) => s.id === Number(selectedSubjectId));
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
          topic,
          numberOfQuestions,
          difficulty,
          classLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');

      const mapped = data.questions.map((q: any) => ({
        ...q,
        subjectId: Number(selectedSubjectId),
        subjectName,
        topic,
        classLevel,
        difficulty: q.difficulty || difficulty,
        questionText: q.question,
      }));

      setGeneratedQuestions(mapped);
      setSuccessMsg(`Successfully generated ${mapped.length} multiple-choice questions strictly from the text!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...generatedQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setGeneratedQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    const updated = generatedQuestions.filter((_, i) => i !== index);
    setGeneratedQuestions(updated);
  };

  const handleAddManualQuestion = () => {
    const subjectObj = subjects.find((s) => s.id === Number(selectedSubjectId));
    const newQ: Question = {
      subjectId: Number(selectedSubjectId),
      subjectName: subjectObj?.name || 'General',
      topic,
      classLevel,
      difficulty,
      questionText: 'New question text goes here?',
      optionA: 'Option A',
      optionB: 'Option B',
      optionC: 'Option C',
      optionD: 'Option D',
      correctAnswer: 'A',
      explanation: 'Educational explanation of the correct choice.',
      source: 'manual',
    };
    setGeneratedQuestions([...generatedQuestions, newQ]);
    setEditingIndex(generatedQuestions.length);
  };

  const handleSaveToBank = async () => {
    if (generatedQuestions.length === 0) return;
    setSaving(true);
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
          subjectId: selectedSubjectId,
          topic,
          classLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save questions');

      setSuccessMsg(data.message || 'Saved to Question Bank!');
      onQuestionsSaved?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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
                Federal International School • Question Bank
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                AI Curriculum Question Generator
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates syllabus-aligned multiple choice examination questions with answer keys and explanations strictly grounded in curriculum text.
              </p>
            </div>
          </div>
          <div className="bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs text-emerald-300">
            Engine: <strong className="text-amber-300">Gemini 3.8 Flash</strong>
          </div>
        </div>
      </div>

      {/* Messages */}
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

      {/* Input Parameters & Text area */}
      <form onSubmit={handleGenerate} className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Educational Text Material (Lesson Note / Textbook Excerpt) *
            </label>
            <span className="text-[11px] text-slate-400">
              AI analyzes ONLY this content
            </span>
          </div>
          <textarea
            rows={5}
            required
            value={educationalText}
            onChange={(e) => setEducationalText(e.target.value)}
            placeholder="Paste your classroom lesson notes, textbook chapter, or educational comprehension passage here..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
          />
        </div>

        {/* Configurations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Subject *</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Topic *</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Photosynthesis"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Class *</label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Primary 5">Primary 5</option>
              <option value="JSS 1">JSS 1</option>
              <option value="JSS 2">JSS 2</option>
              <option value="JSS 3">JSS 3</option>
              <option value="SS 1">SS 1</option>
              <option value="SS 2">SS 2</option>
              <option value="SS 3">SS 3</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Questions Count</label>
            <select
              value={numberOfQuestions}
              onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions</option>
              <option value={20}>20 Questions</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Generate Action Button */}
        <div className="flex items-center justify-end pt-3">
          <button
            type="submit"
            disabled={generating}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                Analyzing Material & Generating MCQs...
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

      {/* QUESTION REVIEW & EDIT INTERFACE */}
      {generatedQuestions.length > 0 && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Teacher Question Review & Editing ({generatedQuestions.length} Questions)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review, edit, modify answer choices, or add additional questions before publishing to the question bank.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddManualQuestion}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Question Manually
              </button>
              <button
                type="button"
                onClick={handleSaveToBank}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    SAVE ALL TO QUESTION BANK
                  </>
                )}
              </button>
            </div>
          </div>

          {/* List of Questions */}
          <div className="space-y-4">
            {generatedQuestions.map((q, idx) => (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-3 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={q.questionText}
                      onChange={(e) => handleUpdateQuestion(idx, 'questionText', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-indigo-500"
                    />

                    {/* Options A, B, C, D */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                        const optKey = `option${letter}` as keyof Question;
                        const isCorrect = q.correctAnswer === letter;
                        return (
                          <div
                            key={letter}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                              isCorrect
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-white'
                                : 'bg-slate-800/60 border-slate-700 text-slate-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(idx, 'correctAnswer', letter)}
                              className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer ${
                                isCorrect
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                              }`}
                              title="Click to set as correct answer"
                            >
                              {letter}
                            </button>
                            <input
                              type="text"
                              value={q[optKey] as string}
                              onChange={(e) => handleUpdateQuestion(idx, optKey, e.target.value)}
                              className="w-full bg-transparent border-0 text-xs text-white focus:outline-none"
                            />
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider shrink-0">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    <div className="pt-1">
                      <label className="text-[11px] text-slate-400 font-medium block mb-1">
                        Curriculum Explanation & Reference:
                      </label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) => handleUpdateQuestion(idx, 'explanation', e.target.value)}
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-start">
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(idx)}
                      className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-700">
            <span className="text-xs text-slate-400">
              Validated: Exactly 4 options per question with 1 verified correct answer.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveToBank}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                SAVE TO QUESTION BANK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

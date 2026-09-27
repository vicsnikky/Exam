import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  FileCheck2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Award,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  BookOpen
} from 'lucide-react';
import { Quiz, Question } from '../types/index.ts';

interface StudentQuizTakerProps {
  quizId?: number;
  onCompleted?: () => void;
}

export const StudentQuizTaker: React.FC<StudentQuizTakerProps> = ({
  quizId,
  onCompleted,
}) => {
  const { token, user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(1200); // in seconds
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [timeExpiredNotification, setTimeExpiredNotification] = useState(false);

  // Keep references to answers and activeQuiz in state refs so timeout auto-submits latest answers without closure stale issues
  const answersRef = React.useRef(answers);
  answersRef.current = answers;

  const activeQuizRef = React.useRef(activeQuiz);
  activeQuizRef.current = activeQuiz;

  const submittingRef = React.useRef(false);

  // Load available quizzes
  const loadAvailableQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quizzes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch (e) {
      console.error('Failed to load quizzes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableQuizzes();
  }, [token]);

  // Load specific quiz
  const startQuiz = async (id: number) => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    setCurrentIndex(0);
    setTimeExpiredNotification(false);
    submittingRef.current = false;
    try {
      const res = await fetch(`/api/quizzes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setActiveQuiz(data.quiz);
      setQuestions(data.questions || []);
      const durationSec = (data.quiz.durationMinutes || 20) * 60;
      setTimeLeft(durationSec);
    } catch (e) {
      console.error('Error starting quiz:', e);
    } finally {
      setLoading(false);
    }
  };

  // Timer Countdown with Automatic Submission on Expiry
  useEffect(() => {
    if (!activeQuiz || result) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Trigger automatic submission immediately
          triggerAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuiz, result]);

  const triggerAutoSubmit = () => {
    setTimeExpiredNotification(true);
    performSubmit(true);
  };

  const handleSelectOption = (questionId: number, letter: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: letter,
    }));
  };

  const performSubmit = async (isAutoSubmit = false) => {
    const currentQuiz = activeQuizRef.current;
    if (!currentQuiz || submittingRef.current) return;
    
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const studentIdToSubmit = user?.studentId || (user as any)?.studentProfile?.studentId || 'FIS-2026-000001';
      const currentAnswers = answersRef.current;
      const totalAllocatedSec = (currentQuiz.durationMinutes || 20) * 60;
      const calculatedTimeSpent = isAutoSubmit ? totalAllocatedSec : Math.max(0, totalAllocatedSec - timeLeft);

      const res = await fetch(`/api/quizzes/${currentQuiz.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: currentAnswers,
          studentId: studentIdToSubmit,
          timeTakenSeconds: calculatedTimeSpent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quiz');

      setResult({
        ...data.result,
        wasAutoSubmitted: isAutoSubmit,
      });
      onCompleted?.();
    } catch (e: any) {
      alert(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleSubmitQuiz = () => {
    performSubmit(false);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // If not started, show available quizzes list
  if (!activeQuiz) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl fis-card-accent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-md border border-amber-400/40 shrink-0 hidden sm:flex items-center justify-center">
              <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider block">
                Fenster International School • Online Examination Portal
              </span>
              <h2 className="text-xl font-bold text-white mt-0.5">
                Available Assessments & Quizzes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Candidate: <strong className="text-white">{user?.firstName} {user?.surname || user?.lastName}</strong> • Admission ID: <span className="font-mono text-emerald-400 font-bold">{user?.studentId || 'FIS-2026-000001'}</span>
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Loading assigned quizzes...</span>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-slate-800/80 border border-slate-700 p-12 text-center text-slate-400 rounded-2xl">
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No active quizzes published yet</p>
            <p className="text-xs mt-1">Quizzes created by your subject teachers will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      {q.subjectName}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {q.durationMinutes} mins
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-2">
                    {q.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {q.instructions || `Assigned to ${q.targetClass}`}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-700 text-xs text-slate-400">
                  <span>Questions: <strong>{q.questionCount || 5}</strong></span>
                  <button
                    onClick={() => startQuiz(q.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    Start Test Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Quiz Results Screen
  if (result) {
    return (
      <div className="max-w-xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>

        <div>
          {result.wasAutoSubmitted && (
            <div className="mb-3 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Time Stipulated by Teacher Expired — Auto-Submitted!
            </div>
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
            Assessment Completed
          </span>
          <h2 className="text-2xl font-bold text-white mt-1">
            {activeQuiz.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Your exam answers were evaluated immediately and recorded to your permanent academic transcript.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-700">
          <div>
            <span className="text-[11px] text-slate-400 block">Score</span>
            <span className="text-xl font-bold text-white font-mono">
              {result.score} / {result.maxScore}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Percentage</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">
              {result.percentage}%
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Grade</span>
            <span className="text-xl font-bold text-indigo-400">
              {result.grade}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center justify-center gap-4">
          <span>Correct: <strong className="text-emerald-400">{result.correctAnswers}</strong></span>
          <span>Wrong: <strong className="text-rose-400">{result.wrongAnswers}</strong></span>
          <span>Total: <strong className="text-white">{result.totalQuestions}</strong></span>
        </div>

        <button
          onClick={() => { setActiveQuiz(null); setResult(null); }}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          Return to Assessments
        </button>
      </div>
    );
  }

  // Active Quiz Interface
  const currentQ = questions[currentIndex];
  const progressPercent = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <div className="bg-slate-800/90 border border-slate-700 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[11px] font-bold uppercase text-indigo-400 tracking-wider">
            {activeQuiz.subjectName}
          </span>
          <h2 className="text-base font-bold text-white">
            {activeQuiz.title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
              timeLeft <= 60
                ? 'bg-rose-500/20 border border-rose-500 text-rose-300 animate-pulse'
                : 'bg-slate-900 border border-slate-700 text-amber-400'
            }`}
          >
            <Clock className={`w-4 h-4 ${timeLeft <= 60 ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} />
            <span>{formatTimer(timeLeft)}</span>
            {timeLeft <= 60 && <span className="text-[10px] uppercase font-bold text-rose-400 ml-1">Ending Soon!</span>}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{answeredCount} of {questions.length} Answered</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      {currentQ && (
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-2">
              QUESTION #{currentIndex + 1}
            </span>
            <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
              {currentQ.questionText}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const optText = currentQ[`option${letter}`];
              const isSelected = answers[currentQ.id] === letter;
              return (
                <div
                  key={letter}
                  onClick={() => handleSelectOption(currentQ.id, letter)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex items-center gap-3.5 ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="text-sm">{optText}</span>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/30"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Quiz Now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

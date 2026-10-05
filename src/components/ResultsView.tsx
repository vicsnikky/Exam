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
  Printer
} from 'lucide-react';
import { Subject } from '../types/index.ts';
import { SCHOOL_CLASSES } from '../constants/classes.ts';

export const ResultsView: React.FC = () => {
  const { token } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

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
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error('Failed to load results:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/subjects', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSubjects(d.subjects || []));

    fetchResults();
  }, [token]);

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

        <button
          onClick={handleExportCSV}
          disabled={results.length === 0}
          className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-50 border border-emerald-600/50 shadow-md shadow-emerald-950"
        >
          <Download className="w-4 h-4 text-amber-400" />
          Export to CSV / Excel
        </button>
      </div>

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
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
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
          <span>Configurable Grading: A (70-100), B (60-69), C (50-59), D (45-49), E (40-44), F (0-39)</span>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-300">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-700/30 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white block">{r.studentName}</span>
                      <span className="font-mono text-emerald-400 text-[11px]">{r.studentId}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{r.class}</td>
                    <td className="py-3.5 px-4 font-semibold text-indigo-300">
                      {r.subjectName} ({r.subjectCode})
                    </td>
                    <td className="py-3.5 px-4">{r.assessmentTitle}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      {r.score} / {r.maxScore}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

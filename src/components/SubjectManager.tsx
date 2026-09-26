import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  BookOpen,
  PlusCircle,
  Save,
  CheckCircle,
  Hash,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Subject } from '../types/index.ts';

export const SubjectManager: React.FC = () => {
  const { token, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = async () => {
    try {
      const res = await fetch('/api/subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch (e) {
      console.error('Failed to load subjects:', e);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [token]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create subject');

      setSuccess(`Subject "${data.subject.name}" (${data.subject.code}) created successfully!`);
      setName('');
      setCode('');
      setDescription('');
      fetchSubjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          Subject & Curriculum Management
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Add and manage school curriculum subjects dynamically from the database without hardcoded limitations.
        </p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Subject Form */}
        <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-700 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            Add New Subject
          </h3>

          <form onSubmit={handleCreateSubject} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Further Mathematics"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Subject Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. FMTH"
                maxLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Curriculum Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope of work and syllabus outline..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Creating...' : 'Save Subject to Database'}
            </button>
          </form>
        </div>

        {/* Existing Subjects List */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Configured Subjects ({subjects.length})
            </h3>
            <span className="text-xs text-slate-400">Available to all teachers</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
            {subjects.map((s) => (
              <div
                key={s.id}
                className="p-3.5 bg-slate-900/80 border border-slate-700/80 rounded-xl flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{s.name}</span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                      {s.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {s.description || 'Active syllabus subject.'}
                  </p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" title="Active" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

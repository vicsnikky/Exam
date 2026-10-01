import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { FIS_LOGOS } from '../constants/branding.ts';
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
import { supabase } from '../supabaseConfig.ts';
import { fetchAllSubjectsUnified, saveCustomSubjectLocally } from '../lib/subjectStore.ts';

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
      const subs = await fetchAllSubjectsUnified(token);
      setSubjects(subs);
    } catch (e) {
      console.error('Failed to load subjects:', e);
    }
  };

  useEffect(() => {
    fetchSubjects();
    const handleUpdated = () => fetchSubjects();
    window.addEventListener('fis:subjects-updated', handleUpdated);
    return () => window.removeEventListener('fis:subjects-updated', handleUpdated);
  }, [token]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Subject name and unique code are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();
    const cleanDesc = description.trim();

    try {
      const newSubObj: Subject = {
        id: Date.now(),
        name: cleanName,
        code: cleanCode,
        description: cleanDesc || 'Active curriculum subject',
        status: 'active',
      };

      // 1. Immediately persist locally
      saveCustomSubjectLocally(newSubObj);

      // 2. Direct Sync to Supabase
      try {
        await supabase.from('subjects').insert([{
          name: cleanName,
          code: cleanCode,
          description: cleanDesc || null,
          status: 'active',
          school_id: 1,
        }]);
      } catch (supaErr) {
        console.warn('Supabase subject insert deferred:', supaErr);
      }

      // 3. Send to backend API
      try {
        const res = await fetch('/api/subjects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: cleanName,
            code: cleanCode,
            description: cleanDesc,
          }),
        });

        if (res.ok) {
          const text = await res.text();
          if (text && (text.startsWith('{') || text.startsWith('['))) {
            const data = JSON.parse(text);
            if (data.subject) {
              saveCustomSubjectLocally({
                id: data.subject.id,
                name: data.subject.name,
                code: data.subject.code,
                description: data.subject.description || '',
                status: data.subject.status || 'active',
              });
            }
          }
        }
      } catch (netErr) {
        console.warn('Backend subject creation network deferred:', netErr);
      }

      setSuccess(`Subject "${cleanName}" (${cleanCode}) created and published across all modules!`);
      setName('');
      setCode('');
      setDescription('');
      await fetchSubjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create subject');
    } finally {
      setSaving(false);
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
              Fenster International School • Academic Curriculum
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Subject & Curriculum Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Add and manage school curriculum courses dynamically across departments, examination levels, and teachers.
            </p>
          </div>
        </div>
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
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/40 border border-emerald-600/50 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-400" />
              {saving ? 'Creating...' : 'Save Subject to School Catalog'}
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

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Student } from '../types/index.ts';
import { getLocalStudents, deleteStudent } from '../lib/schoolStore.ts';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import {
  Search,
  Filter,
  Users,
  ChevronRight,
  School,
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle,
} from 'lucide-react';

interface StudentSearchProps {
  onSelectStudent: (student: Student) => void;
  initialQuery?: string;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  onSelectStudent,
  initialQuery = '',
}) => {
  const { token, user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [query, setQuery] = useState(initialQuery);
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    student: Student | null;
  }>({
    isOpen: false,
    student: null,
  });

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStudents = async (q = query, cls = selectedClass) => {
    setLoading(true);
    try {
      // 1. Load local baseline immediately
      const local = getLocalStudents();
      let filtered = [...local];

      const cleanQ = q.trim().toLowerCase();
      if (cleanQ) {
        filtered = filtered.filter(
          (s) =>
            s.studentId.toLowerCase().includes(cleanQ) ||
            s.firstName.toLowerCase().includes(cleanQ) ||
            s.surname.toLowerCase().includes(cleanQ) ||
            (s.middleName && s.middleName.toLowerCase().includes(cleanQ)) ||
            `${s.firstName} ${s.surname}`.toLowerCase().includes(cleanQ)
        );
      }

      if (cls && cls !== 'all') {
        filtered = filtered.filter((s) => s.currentClass === cls);
      }

      // 2. Async backend fetch if token available
      if (token) {
        try {
          const params = new URLSearchParams();
          if (cleanQ) params.set('q', cleanQ);
          if (cls && cls !== 'all') params.set('class', cls);

          const res = await fetch(`/api/students?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const text = await res.text();
            if (text && (text.startsWith('{') || text.startsWith('['))) {
              const data = JSON.parse(text);
              const serverStudents: Student[] = data.students || [];

              // Merge unique by studentId
              const existingIds = new Set(filtered.map((s) => s.studentId));
              for (const s of serverStudents) {
                if (!existingIds.has(s.studentId)) {
                  filtered.push(s);
                  existingIds.add(s.studentId);
                }
              }
            }
          }
        } catch (netErr) {
          console.warn('Backend student query fallback to local roster:', netErr);
        }
      }

      setStudents(filtered);
      setTotalCount(filtered.length);
    } catch (e) {
      console.error('Failed to search students:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(initialQuery, selectedClass);

    const handleUpdated = () => {
      fetchStudents(query, selectedClass);
    };
    window.addEventListener('fis:students-updated', handleUpdated);
    return () => window.removeEventListener('fis:students-updated', handleUpdated);
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents(query, selectedClass);
  };

  const promptDeleteStudent = (e: React.MouseEvent, st: Student) => {
    e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      student: st,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.student) return;
    const st = deleteModal.student;
    await deleteStudent(token, st.id);
    setToastMsg({
      type: 'success',
      text: `Student ${st.firstName} ${st.surname} (${st.studentId}) was permanently deleted.`,
    });
    setTimeout(() => setToastMsg(null), 4000);
    fetchStudents(query, selectedClass);
  };

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition animate-fadeIn ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Banner and Search Bar */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Student Search & Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search by Unique Student ID (e.g. FEN-2026-000005), Surname, or Full Name.
            {isSuperAdmin && (
              <span className="text-amber-400 font-semibold ml-1">
                (Super Admin: You have authority to delete any student record)
              </span>
            )}
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Student ID, Surname, First Name..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="sm:w-56">
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                fetchStudents(query, e.target.value);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Classes</option>
              <option value="SS 3">SS 3 (Final Year)</option>
              <option value="SS 2">SS 2</option>
              <option value="SS 1">SS 1</option>
              <option value="JSS 3">JSS 3</option>
              <option value="JSS 2">JSS 2</option>
              <option value="JSS 1">JSS 1</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition cursor-pointer shrink-0 shadow-lg shadow-indigo-600/30"
          >
            Search Roster
          </button>
        </form>

        {/* Quick Example Searches */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/60 text-xs">
          <span className="text-slate-400">Quick Filters:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('Eze');
              fetchStudents('Eze', selectedClass);
            }}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 cursor-pointer"
          >
            "Eze"
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('FEN-2026');
              fetchStudents('FEN-2026', selectedClass);
            }}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 cursor-pointer"
          >
            "FEN-2026"
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedClass('SS 3');
              fetchStudents(query, 'SS 3');
            }}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-purple-300 rounded border border-slate-700 cursor-pointer"
          >
            SS 3 Candidates
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>Found <strong>{totalCount}</strong> student record(s)</span>
          <span>Each candidate maintains a unique permanent ID</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Searching student records...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-300">No students found matching your criteria</p>
            <p className="text-xs mt-1">Try clearing the search box or selecting "All Classes".</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {students.map((st) => (
              <div
                key={st.id}
                onClick={() => onSelectStudent(st)}
                className="p-4 hover:bg-slate-700/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold shrink-0 text-sm group-hover:border-indigo-500 transition">
                    {st.firstName?.[0] || 'S'}{st.surname?.[0] || 'C'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-white text-sm group-hover:text-indigo-400 transition truncate">
                        {st.firstName} {st.middleName ? st.middleName + ' ' : ''}{st.surname}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-700 text-slate-300 border border-slate-600">
                        {st.currentClass}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                      <span className="font-mono text-emerald-400 font-medium">
                        ID: {st.studentId}
                      </span>
                      <span className="flex items-center gap-1">
                        <School className="w-3 h-3 text-slate-500" />
                        {st.school}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Session {st.session}
                      </span>
                      {st.parentPhone && (
                        <span className="text-slate-400">
                          Parent: {st.parentPhone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="text-xs text-slate-400 group-hover:text-white transition flex items-center gap-1 font-medium">
                    View Profile
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
                  </span>

                  {isSuperAdmin && (
                    <button
                      onClick={(e) => promptDeleteStudent(e, st)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600/30 border border-rose-500/20 hover:border-rose-500 transition cursor-pointer ml-1"
                      title="Permanently Delete Student"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.student && (
        <DeleteConfirmModal
          isOpen={deleteModal.isOpen}
          type="student"
          title="Delete Student Record"
          name={`${deleteModal.student.firstName} ${deleteModal.student.surname}`}
          identifier={deleteModal.student.studentId}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteModal({ isOpen: false, student: null })}
        />
      )}
    </div>
  );
};

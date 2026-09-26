import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Search,
  Users,
  ChevronRight,
  Filter,
  GraduationCap,
  Calendar,
  School,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { Student } from '../types/index.ts';

interface StudentSearchProps {
  onSelectStudent: (student: Student) => void;
  initialQuery?: string;
}

export const StudentSearch: React.FC<StudentSearchProps> = ({
  onSelectStudent,
  initialQuery = '',
}) => {
  const { token } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchStudents = async (q = query, cls = selectedClass) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (cls && cls !== 'all') params.set('class', cls);

      const res = await fetch(`/api/students?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
        setTotalCount(data.total || 0);
      }
    } catch (e) {
      console.error('Failed to search students:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents(initialQuery, selectedClass);
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents(query, selectedClass);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Search Bar */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Student Search & Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search by Unique Student ID (e.g. FIS-2026-000001), Surname (e.g. Johnson), or Full Name.
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
              <option value="Primary 1">Primary 1</option>
              <option value="Primary 5">Primary 5</option>
              <option value="JSS 1">JSS 1</option>
              <option value="JSS 2">JSS 2</option>
              <option value="JSS 3">JSS 3</option>
              <option value="SS 1">SS 1</option>
              <option value="SS 2">SS 2</option>
              <option value="SS 3">SS 3</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>

        {/* Quick Example Searches */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/60 text-xs">
          <span className="text-slate-400">Quick Test Searches:</span>
          <button
            type="button"
            onClick={() => { setQuery('Johnson'); fetchStudents('Johnson', selectedClass); }}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 cursor-pointer"
          >
            "Johnson" (shows 3 distinct records, never merged)
          </button>
          <button
            type="button"
            onClick={() => { setQuery('FIS-2026-000001'); fetchStudents('FIS-2026-000001', selectedClass); }}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-emerald-300 rounded border border-slate-700 cursor-pointer"
          >
            "FIS-2026-000001"
          </button>
          <button
            type="button"
            onClick={() => { setQuery('SS 2'); fetchStudents('SS 2', selectedClass); }}
            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-700 text-purple-300 rounded border border-slate-700 cursor-pointer"
          >
            "SS 2"
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <span>Found <strong>{totalCount}</strong> student record(s)</span>
          <span>Each student maintains a distinct permanent ID</span>
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
            <p className="text-xs mt-1">Try searching by partial name or change the class filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {students.map((st) => (
              <div
                key={st.id}
                onClick={() => onSelectStudent(st)}
                className="p-4 hover:bg-slate-700/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold shrink-0 text-sm group-hover:border-indigo-500 transition">
                    {st.firstName[0]}{st.surname[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-sm group-hover:text-indigo-400 transition">
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
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs text-indigo-400 group-hover:underline flex items-center gap-1">
                    Open Profile & Scores
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

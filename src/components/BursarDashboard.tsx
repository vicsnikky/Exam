import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Student } from '../types/index.ts';
import { fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import { getAllFeeLocks, setStudentFeeLock } from '../lib/bursarStore.ts';
import { FIS_LOGOS } from '../constants/branding.ts';
import {
  CreditCard,
  Lock,
  Unlock,
  Search,
  Filter,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ShieldAlert,
  Loader2,
  Check,
  RefreshCw,
} from 'lucide-react';

export const BursarDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeLocks, setFeeLocks] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allStudents, currentLocks] = await Promise.all([
        fetchAllStudentsUnified(token),
        getAllFeeLocks(),
      ]);
      setStudents(allStudents);
      setFeeLocks(currentLocks);
    } catch (e) {
      console.warn('Error loading bursary data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleLocksUpdated = () => {
      setFeeLocks(getAllFeeLocks());
    };
    window.addEventListener('fis:fee-locks-updated', handleLocksUpdated);
    window.addEventListener('fis:students-updated', loadData);
    return () => {
      window.removeEventListener('fis:fee-locks-updated', handleLocksUpdated);
      window.removeEventListener('fis:students-updated', loadData);
    };
  }, [token]);

  const handleToggleLock = async (st: Student) => {
    const sId = st.studentId.toUpperCase();
    const currentlyLocked = Boolean(feeLocks[sId]?.locked);
    const newLockState = !currentlyLocked;

    setUpdatingId(sId);
    try {
      await setStudentFeeLock(sId, newLockState, {
        studentDbId: st.id,
        reason: newLockState ? 'Outstanding tuition / school fees unpaid' : 'Cleared by Bursary',
        updatedBy: `${user?.firstName || 'Bursar'} (${user?.role || 'Bursary'})`,
        token,
      });

      setToastMsg({
        type: newLockState ? 'info' : 'success',
        text: newLockState
          ? `Result Access WITHHELD for ${st.firstName} ${st.surname} (${st.studentId}). Student cannot view academic report until cleared.`
          : `Result Access UNLOCKED for ${st.firstName} ${st.surname} (${st.studentId}). Student can now access report cards.`,
      });
      setTimeout(() => setToastMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to update fee lock state: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter logic
  const filteredStudents = students.filter((s) => {
    const sId = (s.studentId || '').toUpperCase();
    const isLocked = Boolean(feeLocks[sId]?.locked);

    if (selectedStatus === 'locked' && !isLocked) return false;
    if (selectedStatus === 'unlocked' && isLocked) return false;

    if (selectedClass !== 'all' && s.currentClass !== selectedClass) return false;

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchName = `${s.firstName} ${s.surname}`.toLowerCase().includes(q);
      const matchId = sId.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }

    return true;
  });

  const totalCount = students.length;
  const lockedCount = students.filter((s) => Boolean(feeLocks[s.studentId.toUpperCase()]?.locked)).length;
  const unlockedCount = totalCount - lockedCount;
  const clearedPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 p-6 sm:p-8 rounded-2xl shadow-xl fis-card-accent relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-56 w-auto" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span>Fenster International School • Bursary & Financial Directorate</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              School Fees Clearance & Result Lock Desk
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Authorized portal for Bursars and Super Admins. Restrict student access to academic report cards, continuous assessment ledgers, and SS3 mock results until school fees are cleared.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Roster
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 animate-fadeIn ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-200'
              : 'bg-amber-950/90 border border-amber-500 text-amber-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Enrolled Students</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white font-mono">{totalCount}</div>
          <div className="mt-1 text-[11px] text-slate-400">Institutional student body</div>
        </div>

        <div className="bg-slate-800/80 border border-emerald-500/30 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Financially Cleared</span>
            <Unlock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-400 font-mono">{unlockedCount}</div>
          <div className="mt-1 text-[11px] text-emerald-300/80">Can view & print academic results</div>
        </div>

        <div className="bg-slate-800/80 border border-rose-500/30 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Fee Defaulters (Locked)</span>
            <Lock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-rose-400 font-mono">{lockedCount}</div>
          <div className="mt-1 text-[11px] text-rose-300/80">Results withheld on student portal</div>
        </div>

        <div className="bg-slate-800/80 border border-amber-500/30 p-5 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Clearance Rate</span>
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-300 font-mono">{clearedPercentage}%</div>
          <div className="mt-1 text-[11px] text-slate-400">Target: 100% term tuition compliance</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student by surname, first name, or Student ID (e.g. FEN-2026-000001)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="sm:w-48">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
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

          <div className="sm:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Fee Statuses</option>
              <option value="unlocked">Cleared Only (Unlocked)</option>
              <option value="locked">Defaulters Only (Locked)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-700/60">
          <span>Showing {filteredStudents.length} of {students.length} scholars</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Cleared (Unlocked)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Withheld (Locked)
            </span>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <span>Loading student financial registry...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No students match current search or filters</p>
            <p className="text-xs mt-1">Try resetting the class or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-700 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Student Scholar</th>
                  <th className="py-3.5 px-4">Student ID</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4 text-center">Fee Status</th>
                  <th className="py-3.5 px-4">Lock / Clearance Reason</th>
                  <th className="py-3.5 px-4 text-right">Bursary Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredStudents.map((st) => {
                  const sId = st.studentId.toUpperCase();
                  const lockInfo = feeLocks[sId];
                  const isLocked = Boolean(lockInfo?.locked);
                  const isUpdating = updatingId === sId;

                  return (
                    <tr
                      key={st.id || sId}
                      className={`hover:bg-slate-750/80 transition ${
                        isLocked ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isLocked
                              ? 'bg-rose-900/40 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {(st.firstName?.[0] || 'S')}{(st.surname?.[0] || 'C')}
                          </div>
                          <div>
                            <span className="font-bold text-white block">
                              {st.firstName} {st.middleName ? st.middleName + ' ' : ''}{st.surname}
                            </span>
                            <span className="text-[10px] text-slate-400">{st.school}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-amber-300">
                        {st.studentId}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-900 border border-slate-700 text-slate-200">
                          {st.currentClass}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <Lock className="w-3 h-3 text-rose-400" />
                            LOCKED (Withheld)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <Check className="w-3 h-3 text-emerald-400" />
                            CLEARED (Visible)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 text-[11px]">
                        {lockInfo?.reason || (isLocked ? 'Fees Pending' : 'Financial Clearance Complete')}
                        {lockInfo?.updatedBy && (
                          <span className="block text-[10px] text-slate-500">
                            by {lockInfo.updatedBy}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggleLock(st)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer ${
                            isLocked
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/40'
                          } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isLocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              Unlock Results
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              Lock Results
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

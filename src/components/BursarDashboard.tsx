import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Student } from '../types/index.ts';
import { fetchAllStudentsUnified } from '../lib/schoolStore.ts';
import {
  getAllFeeLocks,
  setStudentFeeLock,
  getAllClassFees,
  saveAllClassFees,
  getAllStudentPayments,
  recordStudentPayment,
  evaluateStudentDebtorStatus,
  DEFAULT_CLASS_FEES,
  StudentDebtorStatus,
} from '../lib/bursarStore.ts';
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
  DollarSign,
  Settings2,
  PlusCircle,
  Download,
  Printer,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  X,
  Building2,
  GraduationCap
} from 'lucide-react';
import { SCHOOL_CLASSES, isSameClass } from '../constants/classes.ts';

const CLASS_OPTIONS = [...SCHOOL_CLASSES];

export const BursarDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeLocks, setFeeLocks] = useState<Record<string, any>>({});
  const [classFees, setClassFees] = useState<Record<string, number>>({ ...DEFAULT_CLASS_FEES });
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Navigation tabs in Bursar Dashboard
  const [activeTab, setActiveTab] = useState<'debtors' | 'class-fees' | 'all-students' | 'record-payment'>('debtors');

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLockFilter, setSelectedLockFilter] = useState<'all' | 'locked' | 'unlocked'>('all');

  // Payment Modal state
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    currentPaid: number;
    amountToInput: string;
    isAddition: boolean;
    receiptNo: string;
    note: string;
  }>({
    isOpen: false,
    student: null,
    currentPaid: 0,
    amountToInput: '',
    isAddition: true,
    receiptNo: '',
    note: 'Tuition payment received',
  });

  // Class fees editing state
  const [editableClassFees, setEditableClassFees] = useState<Record<string, number>>({ ...DEFAULT_CLASS_FEES });
  const [savingFees, setSavingFees] = useState(false);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allStudents, currentLocks, currentFees, currentPayments] = await Promise.all([
        fetchAllStudentsUnified(token),
        getAllFeeLocks(),
        getAllClassFees(),
        getAllStudentPayments(),
      ]);
      setStudents(allStudents);
      setFeeLocks(currentLocks);
      setClassFees(currentFees);
      setEditableClassFees(currentFees);
      setPayments(currentPayments);
    } catch (e) {
      console.warn('Error loading bursary data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      setFeeLocks(getAllFeeLocks());
      setClassFees(getAllClassFees());
      setPayments(getAllStudentPayments());
    };

    window.addEventListener('fis:bursar-data-updated', handleUpdate);
    window.addEventListener('fis:fee-locks-updated', handleUpdate);
    window.addEventListener('fis:students-updated', loadData);

    return () => {
      window.removeEventListener('fis:bursar-data-updated', handleUpdate);
      window.removeEventListener('fis:fee-locks-updated', handleUpdate);
      window.removeEventListener('fis:students-updated', loadData);
    };
  }, [token]);

  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  // Toggle Fee Lock
  const handleToggleLock = async (st: Student, debtorStatus: StudentDebtorStatus) => {
    const sId = (st.studentId || String(st.id)).toUpperCase();
    const currentlyLocked = Boolean(feeLocks[sId]?.locked);
    const newLockState = !currentlyLocked;

    setUpdatingId(sId);
    try {
      await setStudentFeeLock(sId, newLockState, {
        studentDbId: st.id,
        reason: newLockState ? 'Outstanding school fees unpaid' : 'Cleared by Bursary',
        balance: `₦${debtorStatus.balanceDue.toLocaleString()}`,
        updatedBy: `${user?.firstName || 'Bursar'} (${user?.role || 'Bursary'})`,
        token,
      });

      showToast(
        newLockState ? 'info' : 'success',
        newLockState
          ? `Results WITHHELD for ${st.firstName} ${st.surname} (${st.studentId}) due to ₦${debtorStatus.balanceDue.toLocaleString()} unpaid fees.`
          : `Results UNLOCKED for ${st.firstName} ${st.surname} (${st.studentId}). Student can now access terminal report cards.`
      );
    } catch (err: any) {
      showToast('error', 'Failed to update fee lock: ' + (err.message || 'Error'));
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Payment Recording Modal
  const openPaymentModal = (st: Student) => {
    const sId = (st.studentId || String(st.id)).toUpperCase();
    const currentRecord = payments[sId];
    const currentPaid = currentRecord ? currentRecord.amountPaid : 0;

    setPaymentModal({
      isOpen: true,
      student: st,
      currentPaid,
      amountToInput: '',
      isAddition: true,
      receiptNo: `REC-${Date.now().toString().slice(-6)}`,
      note: 'School fees payment installment',
    });
  };

  // Submit Payment Record
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.student) return;

    const val = parseFloat(paymentModal.amountToInput);
    if (isNaN(val) || val <= 0) {
      showToast('error', 'Please enter a valid payment amount greater than zero.');
      return;
    }

    const st = paymentModal.student;
    const sId = (st.studentId || String(st.id)).toUpperCase();

    try {
      const updated = await recordStudentPayment(sId, val, {
        isAddition: paymentModal.isAddition,
        receiptNo: paymentModal.receiptNo,
        note: paymentModal.note,
        updatedBy: `${user?.firstName || 'Bursar'} (${user?.role || 'Bursary'})`,
        studentDbId: st.id,
        currentClass: st.currentClass,
        token,
      });

      setPayments((prev) => ({ ...prev, [sId]: updated }));
      setPaymentModal((prev) => ({ ...prev, isOpen: false }));

      const requiredFee = classFees[st.currentClass] || DEFAULT_CLASS_FEES[st.currentClass] || 150000;
      const remainingBalance = Math.max(0, requiredFee - updated.amountPaid);

      showToast(
        'success',
        `Payment of ₦${val.toLocaleString()} recorded for ${st.firstName} ${st.surname} (${st.studentId}). Total paid: ₦${updated.amountPaid.toLocaleString()} (Remaining: ₦${remainingBalance.toLocaleString()})`
      );
    } catch (err: any) {
      showToast('error', 'Error recording payment: ' + (err.message || 'Failed'));
    }
  };

  // Save all class fees
  const handleSaveClassFees = async () => {
    setSavingFees(true);
    try {
      await saveAllClassFees(editableClassFees, token);
      setClassFees({ ...editableClassFees });
      showToast('success', 'Class tuition fees updated and synced across all debtor ledgers!');
    } catch (err: any) {
      showToast('error', 'Failed to save class fees: ' + (err.message || 'Error'));
    } finally {
      setSavingFees(false);
    }
  };

  // Evaluated Students Data with debtor status
  const studentsWithStatus = useMemo(() => {
    return students.map((s) => {
      const status = evaluateStudentDebtorStatus(s, classFees, payments, feeLocks);
      return {
        student: s,
        status,
      };
    });
  }, [students, classFees, payments, feeLocks]);

  // Debtors Only List (per selected class)
  const debtorsList = useMemo(() => {
    return studentsWithStatus.filter(({ student, status }) => {
      if (!status.isDebtor) return false;

      if (selectedClass !== 'all') {
        const cleanSelected = selectedClass.toUpperCase().replace(/\s+/g, '');
        const cleanClass = (student.currentClass || '').toUpperCase().replace(/\s+/g, '');
        if (cleanClass !== cleanSelected) return false;
      }

      if (selectedLockFilter === 'locked' && !status.isLocked) return false;
      if (selectedLockFilter === 'unlocked' && status.isLocked) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${student.firstName} ${student.surname}`.toLowerCase();
        const sId = (student.studentId || '').toLowerCase();
        if (!fullName.includes(q) && !sId.includes(q)) return false;
      }

      return true;
    });
  }, [studentsWithStatus, selectedClass, selectedLockFilter, searchQuery]);

  // Metrics for Selected Class
  const classMetrics = useMemo(() => {
    const classStudents = selectedClass === 'all'
      ? studentsWithStatus
      : studentsWithStatus.filter(({ student }) => {
          const cleanSelected = selectedClass.toUpperCase().replace(/\s+/g, '');
          const cleanClass = (student.currentClass || '').toUpperCase().replace(/\s+/g, '');
          return cleanClass === cleanSelected;
        });

    const totalEnrolled = classStudents.length;
    const debtors = classStudents.filter((x) => x.status.isDebtor);
    const cleared = classStudents.filter((x) => x.status.isCleared);

    const totalExpected = classStudents.reduce((sum, x) => sum + x.status.requiredFee, 0);
    const totalCollected = classStudents.reduce((sum, x) => sum + x.status.amountPaid, 0);
    const totalDebt = classStudents.reduce((sum, x) => sum + x.status.balanceDue, 0);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

    return {
      totalEnrolled,
      debtorsCount: debtors.length,
      clearedCount: cleared.length,
      totalExpected,
      totalCollected,
      totalDebt,
      collectionRate,
      requiredFee: selectedClass !== 'all' ? (classFees[selectedClass] || 150000) : null,
    };
  }, [studentsWithStatus, selectedClass, classFees]);

  // Export Debtors to CSV
  const handleExportDebtorsCSV = () => {
    if (debtorsList.length === 0) return;

    const headers = [
      'Student ID',
      'Scholar Name',
      'Class',
      'Required School Fee (NGN)',
      'Total Amount Paid (NGN)',
      'Outstanding Debt Balance (NGN)',
      'Fee Clearance Status',
      'Result Lock State',
      'Parent Contact',
    ];

    const rows = debtorsList.map(({ student, status }) => [
      `"${student.studentId}"`,
      `"${student.firstName} ${student.surname}"`,
      `"${student.currentClass}"`,
      status.requiredFee,
      status.amountPaid,
      status.balanceDue,
      `"${status.isDebtor ? 'DEBTOR (Fee Unpaid)' : 'CLEARED'}"`,
      `"${status.isLocked ? 'LOCKED / WITHHELD' : 'UNLOCKED'}"`,
      `"${student.parentName || ''} (${student.parentPhone || ''})"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FIS_Debtors_List_${selectedClass.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : toastMsg.type === 'error'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border border-rose-500/30 p-6 sm:p-8 rounded-2xl shadow-xl fis-card-accent relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <img src={FIS_LOGOS.crest} alt="FIS Crest" className="h-56 w-auto" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
              <CreditCard className="w-4 h-4 text-rose-400" />
              <span>Fenster International School • Bursary Directorate</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              School Fees & Debtors Ledger Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Configure class fee benchmarks, record student payments, track class-by-class debtors ledgers, and manage result locks for unpaid school fees.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportDebtorsCSV}
              disabled={debtorsList.length === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              Export Debtors CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              Print Debtors Report
            </button>
            <button
              onClick={loadData}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer border border-slate-700"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('debtors')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'debtors'
              ? 'bg-rose-700 text-white shadow-lg shadow-rose-950/50'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <TrendingDown className="w-4 h-4 text-rose-300" />
          Debtors List per Class ({debtorsList.length})
        </button>

        <button
          onClick={() => setActiveTab('class-fees')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'class-fees'
              ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-950/50'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Settings2 className="w-4 h-4 text-indigo-300" />
          Class Fee Amounts (Configuration)
        </button>

        <button
          onClick={() => setActiveTab('all-students')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'all-students'
              ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-950/50'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-300" />
          All Students & Clearance Status ({students.length})
        </button>
      </div>

      {/* TAB 1: DEBTORS LIST PER CLASS */}
      {activeTab === 'debtors' && (
        <div className="space-y-6">
          {/* Class Filter Badges Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Select Class:
              </span>
              <button
                onClick={() => setSelectedClass('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  selectedClass === 'all'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                All Classes
              </button>
              {CLASS_OPTIONS.map((cName) => (
                <button
                  key={cName}
                  onClick={() => setSelectedClass(cName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    selectedClass === cName
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{cName}</span>
                  <span className="text-[10px] opacity-75 font-mono">
                    (₦{(classFees[cName] || 150000).toLocaleString()})
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search debtor name/ID..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <select
                value={selectedLockFilter}
                onChange={(e) => setSelectedLockFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="all">All Debtors</option>
                <option value="locked">Only Locked</option>
                <option value="unlocked">Unlocked Only</option>
              </select>
            </div>
          </div>

          {/* Metric KPI Cards for Selected Class */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Class Required Fee
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1 font-mono">
                {classMetrics.requiredFee ? `₦${classMetrics.requiredFee.toLocaleString()}` : 'Per-Class Rate'}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {selectedClass === 'all' ? 'Standard baseline rate' : `Designated for ${selectedClass}`}
              </span>
            </div>

            <div className="bg-slate-900 border border-rose-500/30 p-5 rounded-2xl relative overflow-hidden">
              <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block">
                Total Debtors Count
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1 font-mono">
                {classMetrics.debtorsCount}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {classMetrics.totalEnrolled} scholars</span>
              </div>
              <span className="text-[11px] text-rose-300/80 mt-0.5 block">
                Yet to balance full designated fee
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Outstanding Debt
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1 font-mono">
                ₦{classMetrics.totalDebt.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Uncollected revenue in {selectedClass === 'all' ? 'all classes' : selectedClass}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Fees Collected
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
                ₦{classMetrics.totalCollected.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400/80 mt-0.5 block">
                {classMetrics.collectionRate}% Collection Rate
              </span>
            </div>
          </div>

          {/* Debtors Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  Official Debtors List • {selectedClass === 'all' ? 'All Classes' : selectedClass}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing scholars with an outstanding fee balance below their class designated rate.
                </p>
              </div>
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-full">
                {debtorsList.length} Debtor(s) Listed
              </span>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-rose-400" />
                <span className="text-xs">Computing real-time class debtor balances...</span>
              </div>
            ) : debtorsList.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-base font-bold text-white">No Outstanding Debtors in {selectedClass}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  All scholars in this category have fully cleared their designated school fees!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Scholar Name</th>
                      <th className="py-3 px-4">Admission ID</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4 text-right">Class Required Fee</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4 text-right font-bold text-rose-400">Outstanding Debt</th>
                      <th className="py-3 px-4 text-center">Result Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-300">
                    {debtorsList.map(({ student, status }) => (
                      <tr key={student.id} className="hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {student.firstName} {student.surname}
                          {student.parentPhone && (
                            <span className="block text-[11px] font-normal text-slate-400 font-mono">
                              Parent: {student.parentPhone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-400 font-medium">
                          {student.studentId}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 font-semibold text-[11px]">
                            {student.currentClass}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                          ₦{status.requiredFee.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                          ₦{status.amountPaid.toLocaleString()}
                          <span className="block text-[10px] text-slate-500 font-normal">
                            ({status.percentPaid}%)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-rose-400 text-sm">
                          ₦{status.balanceDue.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {status.isLocked ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Withheld
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold inline-flex items-center gap-1">
                              <Unlock className="w-3 h-3" />
                              Active (Unlocked)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openPaymentModal(student)}
                              className="px-2.5 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border border-emerald-600/40 shadow-sm"
                            >
                              <PlusCircle className="w-3 h-3" />
                              Input Fee Paid
                            </button>
                            <button
                              onClick={() => handleToggleLock(student, status)}
                              disabled={updatingId === student.studentId}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
                                status.isLocked
                                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                                  : 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border-rose-600/40'
                              }`}
                            >
                              {status.isLocked ? (
                                <>
                                  <Unlock className="w-3 h-3 text-emerald-400" />
                                  Unlock
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 text-rose-400" />
                                  Lock Result
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLASS FEE AMOUNTS CONFIGURATION */}
      {activeTab === 'class-fees' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                Class-by-Class Designated School Fee Amounts
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Set the official tuition fee designated for each class. Any student who has paid less than this amount is automatically placed on the Debtors List.
              </p>
            </div>

            <button
              onClick={handleSaveClassFees}
              disabled={savingFees}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950"
            >
              {savingFees ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save All Class Fees
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CLASS_OPTIONS.map((cName) => {
              const currentVal = editableClassFees[cName] !== undefined ? editableClassFees[cName] : (DEFAULT_CLASS_FEES[cName] || 150000);
              const enrolledCount = students.filter((s) => (s.currentClass || '').toUpperCase().replace(/\s+/g, '') === cName.toUpperCase().replace(/\s+/g, '')).length;

              return (
                <div key={cName} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl space-y-3 relative group hover:border-indigo-500 transition">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-amber-400" />
                      {cName}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 bg-slate-800 rounded-full">
                      {enrolledCount} Scholars Enrolled
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Required Fee Amount (NGN)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400 font-mono">₦</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={currentVal}
                        onChange={(e) => {
                          const num = parseFloat(e.target.value) || 0;
                          setEditableClassFees((prev) => ({ ...prev, [cName]: num }));
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                    <span>Formatted:</span>
                    <strong className="text-amber-300 font-mono">₦{currentVal.toLocaleString()}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ALL ENROLLED STUDENTS & CLEARANCE STATUS */}
      {activeTab === 'all-students' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Comprehensive Student Financial Roster
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Overview of all registered scholars, payment status, fee balance, and report card locking permissions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="all">All Classes</option>
                {CLASS_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student or ID..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Scholar Name</th>
                  <th className="py-3 px-4">Admission ID</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-right">Class Fee</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Result Lock</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-300">
                {studentsWithStatus
                  .filter(({ student }) => {
                    if (selectedClass !== 'all' && student.currentClass !== selectedClass) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase().trim();
                      const name = `${student.firstName} ${student.surname}`.toLowerCase();
                      const sId = (student.studentId || '').toLowerCase();
                      return name.includes(q) || sId.includes(q);
                    }
                    return true;
                  })
                  .map(({ student, status }) => (
                    <tr key={student.id} className="hover:bg-slate-700/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {student.firstName} {student.surname}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        {student.studentId}
                      </td>
                      <td className="py-3.5 px-4 font-medium">{student.currentClass}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        ₦{status.requiredFee.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                        ₦{status.amountPaid.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        {status.balanceDue > 0 ? (
                          <span className="text-rose-400">₦{status.balanceDue.toLocaleString()}</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">₦0 (Cleared)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {status.isCleared ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                            Fully Paid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                            Debtor
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {status.isLocked ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                            🔒 Withheld
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            🟢 Unlocked
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openPaymentModal(student)}
                            className="px-2 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold transition cursor-pointer"
                          >
                            + Input Fee
                          </button>
                          <button
                            onClick={() => handleToggleLock(student, status)}
                            disabled={updatingId === student.studentId}
                            className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer ${
                              status.isLocked
                                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                : 'bg-rose-900/60 hover:bg-rose-800 text-rose-200'
                            }`}
                          >
                            {status.isLocked ? 'Unlock' : 'Lock'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: INPUT / RECORD STUDENT FEE PAYMENT */}
      {paymentModal.isOpen && paymentModal.student && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Input Fee Paid by Student</h3>
              </div>
              <button
                onClick={() => setPaymentModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Scholar Name:</span>
                <strong className="text-white text-sm">
                  {paymentModal.student.firstName} {paymentModal.student.surname}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Admission ID:</span>
                <strong className="text-emerald-400 font-mono">{paymentModal.student.studentId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Class:</span>
                <strong className="text-white">{paymentModal.student.currentClass}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Class Designated Fee:</span>
                <strong className="text-amber-300 font-mono">
                  ₦{(classFees[paymentModal.student.currentClass] || 150000).toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-medium">Currently Recorded Paid:</span>
                <strong className="text-emerald-400 font-mono">
                  ₦{paymentModal.currentPaid.toLocaleString()}
                </strong>
              </div>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentModal((prev) => ({ ...prev, isAddition: true }))}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      paymentModal.isAddition
                        ? 'bg-emerald-700 text-white border border-emerald-500'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    + Add New Installment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentModal((prev) => ({ ...prev, isAddition: false }))}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      !paymentModal.isAddition
                        ? 'bg-emerald-700 text-white border border-emerald-500'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Set Total Cumulative Paid
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {paymentModal.isAddition ? 'Amount Being Paid Now (NGN) *' : 'Total Amount Paid (NGN) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400 font-mono">₦</span>
                  <input
                    type="number"
                    min="1"
                    step="100"
                    required
                    value={paymentModal.amountToInput}
                    onChange={(e) =>
                      setPaymentModal((prev) => ({ ...prev, amountToInput: e.target.value }))
                    }
                    placeholder="e.g. 50000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Receipt / Reference No
                  </label>
                  <input
                    type="text"
                    value={paymentModal.receiptNo}
                    onChange={(e) =>
                      setPaymentModal((prev) => ({ ...prev, receiptNo: e.target.value }))
                    }
                    placeholder="REC-12345"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Payment Note / Channel
                  </label>
                  <input
                    type="text"
                    value={paymentModal.note}
                    onChange={(e) =>
                      setPaymentModal((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="e.g. Bank Transfer"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  Confirm & Update Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

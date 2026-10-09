import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Student, StudentFeeAdjustment } from '../types/index.ts';
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
  getHostelFee,
  setHostelFee,
  getAllFeeAdjustments,
  setStudentFeeAdjustment,
  DEFAULT_HOSTEL_FEE,
  calculateStudentFeeBreakdown,
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
  GraduationCap,
  Pencil,
  KeyRound,
  Home,
  BedDouble,
  Award,
  Percent,
  Sparkles,
  Save,
} from 'lucide-react';
import { SCHOOL_CLASSES, isSameClass } from '../constants/classes.ts';

const CLASS_OPTIONS = [...SCHOOL_CLASSES];

export const BursarDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [feeLocks, setFeeLocks] = useState<Record<string, any>>({});
  const [classFees, setClassFees] = useState<Record<string, number>>({ ...DEFAULT_CLASS_FEES });
  const [hostelFee, setHostelFeeState] = useState<number>(DEFAULT_HOSTEL_FEE);
  const [editableHostelFee, setEditableHostelFee] = useState<number>(DEFAULT_HOSTEL_FEE);
  const [savingHostelFee, setSavingHostelFee] = useState(false);
  const [feeAdjustments, setFeeAdjustments] = useState<Record<string, StudentFeeAdjustment>>({});
  const [payments, setPayments] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Navigation tabs in Bursar Dashboard
  const [activeTab, setActiveTab] = useState<'debtors' | 'scholarships-hostel' | 'class-fees' | 'all-students' | 'record-payment'>('debtors');

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLockFilter, setSelectedLockFilter] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [residenceFilter, setResidenceFilter] = useState<'all' | 'day' | 'hostel'>('all');
  const [scholarshipFilter, setScholarshipFilter] = useState<'all' | 'scholarship' | 'none'>('all');

  // Scholarship & Hostel Adjustment Modal state
  const [adjustModal, setAdjustModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    residenceType: 'day' | 'hostel';
    customHostelFee: string;
    scholarshipType: 'none' | 'full' | 'half' | 'percentage' | 'fixed';
    scholarshipPercentage: string;
    scholarshipAmount: string;
    scholarshipName: string;
    scholarshipAppliesTo: 'tuition_only' | 'all_fees';
    notes: string;
  }>({
    isOpen: false,
    student: null,
    residenceType: 'day',
    customHostelFee: '',
    scholarshipType: 'none',
    scholarshipPercentage: '50',
    scholarshipAmount: '50000',
    scholarshipName: '',
    scholarshipAppliesTo: 'tuition_only',
    notes: '',
  });

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

  // Edit / Correct Recorded Fee Modal (in case of wrong entry)
  const [editFeeModal, setEditFeeModal] = useState<{
    isOpen: boolean;
    student: Student | null;
    currentPaid: number;
    correctedAmount: string;
    note: string;
    receiptNo: string;
  }>({
    isOpen: false,
    student: null,
    currentPaid: 0,
    correctedAmount: '',
    note: 'Correction of wrong entry by Bursar',
    receiptNo: '',
  });

  // Class fees editing state
  const [editableClassFees, setEditableClassFees] = useState<Record<string, number>>({ ...DEFAULT_CLASS_FEES });
  const [savingFees, setSavingFees] = useState(false);

  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allStudents, currentLocks, currentFees, currentPayments, currentAdjustments, currentHostel] = await Promise.all([
        fetchAllStudentsUnified(token),
        getAllFeeLocks(),
        getAllClassFees(),
        getAllStudentPayments(),
        getAllFeeAdjustments(),
        getHostelFee(),
      ]);
      setStudents(allStudents);
      setFeeLocks(currentLocks);
      setClassFees(currentFees);
      setEditableClassFees(currentFees);
      setPayments(currentPayments);
      setFeeAdjustments(currentAdjustments);
      setHostelFeeState(currentHostel);
      setEditableHostelFee(currentHostel);
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
      setFeeAdjustments(getAllFeeAdjustments());
      const hFee = getHostelFee();
      setHostelFeeState(hFee);
      setEditableHostelFee(hFee);
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

  // Open Edit / Correct Fee Modal (in case of wrong entry)
  const openEditFeeModal = (st: Student) => {
    const sId = (st.studentId || String(st.id)).toUpperCase();
    const currentRecord = payments[sId];
    const currentPaid = currentRecord ? currentRecord.amountPaid : (st.amountPaid || 0);

    setEditFeeModal({
      isOpen: true,
      student: st,
      currentPaid,
      correctedAmount: String(currentPaid),
      note: 'Correction of wrong entry by Bursar',
      receiptNo: `CORR-${Date.now().toString().slice(-6)}`,
    });
  };

  // Submit Payment Record (Bursar can input ANY amount)
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.student) return;

    const val = parseFloat(paymentModal.amountToInput);
    if (isNaN(val) || val < 0) {
      showToast('error', 'Please enter a valid payment amount (0 or greater).');
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

  // Submit Corrected Fee Record (In case of wrong entry)
  const handleSubmitEditFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFeeModal.student) return;

    const val = parseFloat(editFeeModal.correctedAmount);
    if (isNaN(val) || val < 0) {
      showToast('error', 'Please enter a valid corrected amount (0 or greater).');
      return;
    }

    const st = editFeeModal.student;
    const sId = (st.studentId || String(st.id)).toUpperCase();

    try {
      const updated = await recordStudentPayment(sId, val, {
        isAddition: false, // Set total cumulative paid directly to corrected amount!
        receiptNo: editFeeModal.receiptNo || `CORR-${Date.now().toString().slice(-6)}`,
        note: editFeeModal.note || 'Correction of wrong entry by Bursar',
        updatedBy: `${user?.firstName || 'Bursar'} (${user?.role || 'Bursary'})`,
        studentDbId: st.id,
        currentClass: st.currentClass,
        token,
      });

      setPayments((prev) => ({ ...prev, [sId]: updated }));
      setEditFeeModal((prev) => ({ ...prev, isOpen: false }));

      const requiredFee = classFees[st.currentClass] || DEFAULT_CLASS_FEES[st.currentClass] || 150000;
      const remainingBalance = Math.max(0, requiredFee - val);

      showToast(
        'success',
        `Fee record for ${st.firstName} ${st.surname} (${st.studentId}) corrected to ₦${val.toLocaleString()}. Remaining balance: ₦${remainingBalance.toLocaleString()}.`
      );
    } catch (err: any) {
      showToast('error', 'Error updating corrected fee: ' + (err.message || 'Failed'));
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

  // Save term hostel / boarding fee
  const handleSaveHostelFee = async () => {
    setSavingHostelFee(true);
    try {
      await setHostelFee(editableHostelFee, token);
      setHostelFeeState(editableHostelFee);
      showToast('success', `Term Hostel / Boarding accommodation fee updated to ₦${editableHostelFee.toLocaleString()}!`);
    } catch (err: any) {
      showToast('error', 'Failed to update hostel fee: ' + (err.message || 'Error'));
    } finally {
      setSavingHostelFee(false);
    }
  };

  // Open Scholarship & Hostel Adjustment Modal
  const openAdjustModal = (student: Student) => {
    const sId = (student.studentId || String(student.id)).trim().toUpperCase();
    const adj = feeAdjustments[sId] || feeAdjustments[String(student.id)] || {
      residenceType: (student.residenceType || 'day') as 'day' | 'hostel',
      hostelFee: student.hostelFee,
      scholarshipType: (student.scholarshipType || 'none') as any,
      scholarshipPercentage: student.scholarshipPercentage || 50,
      scholarshipAmount: student.scholarshipAmount || 50000,
      scholarshipName: student.scholarshipName || '',
      scholarshipAppliesTo: 'tuition_only',
      notes: '',
    };

    setAdjustModal({
      isOpen: true,
      student,
      residenceType: (adj.residenceType || 'day') as 'day' | 'hostel',
      customHostelFee: adj.hostelFee !== undefined && adj.hostelFee !== null ? String(adj.hostelFee) : '',
      scholarshipType: (adj.scholarshipType || 'none') as any,
      scholarshipPercentage: String(adj.scholarshipPercentage || '50'),
      scholarshipAmount: String(adj.scholarshipAmount || '50000'),
      scholarshipName: adj.scholarshipName || '',
      scholarshipAppliesTo: (adj.scholarshipAppliesTo as any) || 'tuition_only',
      notes: adj.notes || '',
    });
  };

  // Submit Scholarship & Hostel Adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.student) return;

    const st = adjustModal.student;
    const sId = (st.studentId || String(st.id)).trim().toUpperCase();

    const parsedCustomHostel = adjustModal.customHostelFee.trim() !== ''
      ? Math.max(0, parseFloat(adjustModal.customHostelFee) || 0)
      : undefined;

    const parsedPct = adjustModal.scholarshipType === 'half'
      ? 50
      : adjustModal.scholarshipType === 'full'
      ? 100
      : Math.min(100, Math.max(0, parseFloat(adjustModal.scholarshipPercentage) || 0));

    const parsedAmt = Math.max(0, parseFloat(adjustModal.scholarshipAmount) || 0);

    const adjustmentPayload: Partial<StudentFeeAdjustment> = {
      residenceType: adjustModal.residenceType,
      hostelFee: parsedCustomHostel,
      scholarshipType: adjustModal.scholarshipType,
      scholarshipPercentage: parsedPct,
      scholarshipAmount: parsedAmt,
      scholarshipName: adjustModal.scholarshipName.trim(),
      scholarshipAppliesTo: adjustModal.scholarshipAppliesTo,
      notes: adjustModal.notes.trim(),
      updatedBy: `${user?.firstName || 'Bursar'} (${user?.role || 'Bursary'})`,
    };

    try {
      const saved = await setStudentFeeAdjustment(sId, adjustmentPayload, {
        currentClass: st.currentClass,
        studentDbId: st.id,
        token,
        updatedBy: `${user?.firstName || 'Bursar'} (${user?.role || 'Bursary'})`,
      });

      setFeeAdjustments((prev) => ({
        ...prev,
        [sId]: saved,
        [String(st.id)]: saved,
      }));

      // Re-evaluate balance due and update lock status automatically
      const currentPayments = getAllStudentPayments();
      const currentLocks = getAllFeeLocks();
      const newAdjMap = { ...feeAdjustments, [sId]: saved, [String(st.id)]: saved };
      const newStatus = evaluateStudentDebtorStatus(st, classFees, currentPayments, currentLocks, newAdjMap, hostelFee);

      if (newStatus.balanceDue <= 0) {
        await setStudentFeeLock(sId, false, {
          studentDbId: st.id,
          reason: 'Cleared - Net fee satisfied after scholarship subsidy',
          balance: '₦0',
          updatedBy: 'Bursary Subsidy Clearance',
          token,
        });
      }

      setAdjustModal((prev) => ({ ...prev, isOpen: false }));
      showToast(
        'success',
        `Scholarship & Hostel configuration saved for ${st.firstName} ${st.surname} (${st.studentId}). Net bill: ₦${newStatus.netRequiredFee.toLocaleString()} (Remaining: ₦${newStatus.balanceDue.toLocaleString()}).`
      );
    } catch (err: any) {
      showToast('error', 'Failed to save fee adjustment: ' + (err.message || 'Error'));
    }
  };

  // Evaluated Students Data with debtor status, factoring in hostel & scholarship
  const studentsWithStatus = useMemo(() => {
    return students.map((s) => {
      const status = evaluateStudentDebtorStatus(s, classFees, payments, feeLocks, feeAdjustments, hostelFee);
      return {
        student: s,
        status,
      };
    });
  }, [students, classFees, payments, feeLocks, feeAdjustments, hostelFee]);

  // Debtors Only List (per selected class and filters)
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

      if (residenceFilter === 'day' && status.residenceType === 'hostel') return false;
      if (residenceFilter === 'hostel' && status.residenceType !== 'hostel') return false;

      if (scholarshipFilter === 'scholarship' && status.scholarshipType === 'none') return false;
      if (scholarshipFilter === 'none' && status.scholarshipType !== 'none') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${student.firstName} ${student.surname}`.toLowerCase();
        const sId = (student.studentId || '').toLowerCase();
        if (!fullName.includes(q) && !sId.includes(q)) return false;
      }

      return true;
    });
  }, [studentsWithStatus, selectedClass, selectedLockFilter, residenceFilter, scholarshipFilter, searchQuery]);

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

    const boarders = classStudents.filter((x) => x.status.residenceType === 'hostel');
    const dayScholars = classStudents.filter((x) => x.status.residenceType !== 'hostel');
    const scholarshipScholars = classStudents.filter((x) => x.status.scholarshipType !== 'none');

    const totalExpected = classStudents.reduce((sum, x) => sum + x.status.requiredFee, 0);
    const totalCollected = classStudents.reduce((sum, x) => sum + x.status.amountPaid, 0);
    const totalDebt = classStudents.reduce((sum, x) => sum + x.status.balanceDue, 0);
    const totalSubsidyGranted = classStudents.reduce((sum, x) => sum + x.status.scholarshipDiscount, 0);
    const totalHostelFees = classStudents.reduce((sum, x) => sum + x.status.hostelFee, 0);
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

    return {
      totalEnrolled,
      debtorsCount: debtors.length,
      clearedCount: cleared.length,
      boardersCount: boarders.length,
      dayCount: dayScholars.length,
      scholarshipsCount: scholarshipScholars.length,
      totalExpected,
      totalCollected,
      totalDebt,
      totalSubsidyGranted,
      totalHostelFees,
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
              onClick={() => window.dispatchEvent(new CustomEvent('fis:open-change-password'))}
              className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border border-amber-500/30"
              title="Change Bursar Account Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Change Password
            </button>
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
          onClick={() => setActiveTab('scholarships-hostel')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'scholarships-hostel'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/50'
              : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          Scholarships & Hostels ({studentsWithStatus.filter((x) => x.status.scholarshipType !== 'none' || x.status.residenceType === 'hostel').length})
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
          Class & Hostel Fees Benchmark
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
                      <th className="py-3 px-4">Category / Subsidy</th>
                      <th className="py-3 px-4 text-right">Net Bill Required</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4 text-right font-bold text-rose-400">Outstanding Debt</th>
                      <th className="py-3 px-4 text-center">Result Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-300">
                    {debtorsList.map(({ student, status }, idx) => (
                      <tr key={`dbt_${student.id}_${student.studentId || ''}_${idx}`} className="hover:bg-slate-700/30 transition">
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
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {status.residenceType === 'hostel' ? (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                                🛏️ Boarder (+₦{status.hostelFee.toLocaleString()})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] inline-flex items-center gap-1">
                                🏠 Day
                              </span>
                            )}
                            {status.scholarshipType !== 'none' && (
                              <span className="block text-[10px] text-emerald-400 font-semibold truncate max-w-[150px]">
                                🎓 {status.scholarshipLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="font-bold text-white">
                            ₦{status.netRequiredFee.toLocaleString()}
                          </div>
                          {(status.hostelFee > 0 || status.scholarshipDiscount > 0) && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              Base: ₦{status.baseClassFee.toLocaleString()}
                              {status.hostelFee > 0 && ` + ₦${status.hostelFee.toLocaleString()}`}
                              {status.scholarshipDiscount > 0 && ` - ₦${status.scholarshipDiscount.toLocaleString()}`}
                            </span>
                          )}
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
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => openAdjustModal(student)}
                              className="px-2 py-1 bg-indigo-900/40 hover:bg-indigo-800 text-indigo-300 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border border-indigo-600/40 shadow-sm"
                              title="Configure Scholarship subsidy and Hostel boarding category"
                            >
                              <Award className="w-3 h-3 text-amber-400" />
                              Category
                            </button>
                            <button
                              onClick={() => openPaymentModal(student)}
                              className="px-2 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border border-emerald-600/40 shadow-sm"
                            >
                              <PlusCircle className="w-3 h-3" />
                              + Fee
                            </button>
                            <button
                              onClick={() => openEditFeeModal(student)}
                              className="px-2 py-1 bg-amber-900/40 hover:bg-amber-800 text-amber-300 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border border-amber-600/40 shadow-sm"
                              title="Edit fee record in case of wrong entry"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleLock(student, status)}
                              disabled={updatingId === student.studentId}
                              className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
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
                                  Lock
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

      {/* TAB 2: SCHOLARSHIPS & HOSTEL ACCOMMODATION MANAGEMENT */}
      {activeTab === 'scholarships-hostel' && (
        <div className="space-y-6">
          {/* Header & Explanation */}
          <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/30 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Welfare & Accommodation Directorate</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Scholarships, Subsidies & Hostel Boarding Ledger
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Configure student residential status (Boarders residing in Hostels paying higher fees) and award merit/hardship scholarships (subsidized school fees). All discounts and hostel surcharges calculate automatically in real time.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto bg-slate-900/90 border border-amber-500/40 p-4 rounded-xl">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Standard Term Hostel Fee</span>
                <span className="text-xl font-black text-indigo-300 font-mono">
                  ₦{hostelFee.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Applies to all Boarders</span>
              </div>
              <button
                onClick={() => setActiveTab('class-fees')}
                className="px-3 py-1.5 bg-indigo-700/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Edit Rate
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-indigo-500/30 p-4 sm:p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5 text-indigo-400" />
                Boarders (Hostel Residents)
              </span>
              <div className="text-xl sm:text-2xl font-black text-indigo-300 mt-1 font-mono">
                {classMetrics.boardersCount}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {classMetrics.totalEnrolled}</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Total Hostel Revenue: ₦{classMetrics.totalHostelFees.toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                Day Scholars
              </span>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">
                {classMetrics.dayCount}{' '}
                <span className="text-xs text-slate-400 font-normal">scholars</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Standard class tuition billing
              </span>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 p-4 sm:p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                Scholarship Beneficiaries
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
                {classMetrics.scholarshipsCount}{' '}
                <span className="text-xs text-slate-400 font-normal">scholars</span>
              </div>
              <span className="text-[11px] text-emerald-400/80 mt-0.5 block">
                Full, half, or % subsidy awards
              </span>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 p-4 sm:p-5 rounded-2xl">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Total Subsidies Granted
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1 font-mono">
                ₦{classMetrics.totalSubsidyGranted.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Absorbed institutional waivers
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Classes</option>
                  {CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Residence:</span>
                <select
                  value={residenceFilter}
                  onChange={(e) => setResidenceFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Residences</option>
                  <option value="hostel">🛏️ Boarders (Hostel Only)</option>
                  <option value="day">🏠 Day Students Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Scholarship:</span>
                <select
                  value={scholarshipFilter}
                  onChange={(e) => setScholarshipFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Students</option>
                  <option value="scholarship">🎓 Scholarship Beneficiaries Only</option>
                  <option value="none">Regular Fee Payers Only</option>
                </select>
              </div>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scholar name/ID..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Roster Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Scholar Name</th>
                    <th className="py-3 px-4">Admission ID</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Residence Status</th>
                    <th className="py-3 px-4">Scholarship / Subsidy</th>
                    <th className="py-3 px-4 text-right">Base Tuition</th>
                    <th className="py-3 px-4 text-right">Hostel Fee</th>
                    <th className="py-3 px-4 text-right">Subsidy Waiver</th>
                    <th className="py-3 px-4 text-right font-bold text-white">Net Bill Payable</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-right">Configure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-slate-300">
                  {studentsWithStatus
                    .filter(({ student, status }) => {
                      if (selectedClass !== 'all' && student.currentClass !== selectedClass) return false;
                      if (residenceFilter === 'hostel' && status.residenceType !== 'hostel') return false;
                      if (residenceFilter === 'day' && status.residenceType === 'hostel') return false;
                      if (scholarshipFilter === 'scholarship' && status.scholarshipType === 'none') return false;
                      if (scholarshipFilter === 'none' && status.scholarshipType !== 'none') return false;
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        const name = `${student.firstName} ${student.surname}`.toLowerCase();
                        const sId = (student.studentId || '').toLowerCase();
                        return name.includes(q) || sId.includes(q);
                      }
                      return true;
                    })
                    .map(({ student, status }, idx) => (
                      <tr key={`allst_${student.id}_${student.studentId || ''}_${idx}`} className="hover:bg-slate-700/30 transition">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {student.firstName} {student.surname}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-400">
                          {student.studentId}
                        </td>
                        <td className="py-3.5 px-4 font-medium">{student.currentClass}</td>
                        <td className="py-3.5 px-4">
                          {status.residenceType === 'hostel' ? (
                            <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                              <BedDouble className="w-3 h-3" />
                              Boarder (Hostel)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] inline-flex items-center gap-1">
                              <Home className="w-3 h-3 text-slate-400" />
                              Day Scholar
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {status.scholarshipType !== 'none' ? (
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                                <Award className="w-3 h-3" />
                                {status.scholarshipLabel}
                              </span>
                              {status.scholarshipName && (
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  {status.scholarshipName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Regular Fee</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                          ₦{status.baseClassFee.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          {status.hostelFee > 0 ? (
                            <span className="text-indigo-300 font-semibold">+₦{status.hostelFee.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          {status.scholarshipDiscount > 0 ? (
                            <span className="text-emerald-400 font-semibold">-₦{status.scholarshipDiscount.toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-300 text-sm">
                          ₦{status.netRequiredFee.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-400">
                          ₦{status.amountPaid.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {status.balanceDue > 0 ? (
                            <span className="text-rose-400">₦{status.balanceDue.toLocaleString()}</span>
                          ) : (
                            <span className="text-emerald-400">₦0 (Cleared)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => openAdjustModal(student)}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1 ml-auto shadow-sm"
                          >
                            <Settings2 className="w-3 h-3" />
                            Edit Category
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLASS & HOSTEL FEE AMOUNTS CONFIGURATION */}
      {activeTab === 'class-fees' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                Class-by-Class Designated School Fee & Hostel Accommodation Benchmark
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure baseline tuition fees designated for each class and the term boarding/hostel fee.
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

          {/* HOSTEL ACCOMMODATION BENCHMARK CARD */}
          <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border-2 border-indigo-500/40 p-6 rounded-2xl space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center shrink-0">
                  <BedDouble className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Term Boarding & Hostel Accommodation Fee</span>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold">
                      Global Hostel Benchmark
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    This accommodation & utility charge is automatically billed to all students designated as Boarders (Hostel Residents).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative min-w-[200px]">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400 font-mono">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editableHostelFee}
                    onChange={(e) => setEditableHostelFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                    placeholder="80000"
                  />
                </div>
                <button
                  onClick={handleSaveHostelFee}
                  disabled={savingHostelFee}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shrink-0"
                >
                  {savingHostelFee ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Hostel Fee
                </button>
              </div>
            </div>
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
                        step="any"
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
                  <th className="py-3 px-4">Category / Subsidy</th>
                  <th className="py-3 px-4 text-right">Net Bill</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Result Lock</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 text-slate-300">
                {studentsWithStatus
                  .filter(({ student, status }) => {
                    if (selectedClass !== 'all' && student.currentClass !== selectedClass) return false;
                    if (residenceFilter === 'hostel' && status.residenceType !== 'hostel') return false;
                    if (residenceFilter === 'day' && status.residenceType === 'hostel') return false;
                    if (scholarshipFilter === 'scholarship' && status.scholarshipType === 'none') return false;
                    if (scholarshipFilter === 'none' && status.scholarshipType !== 'none') return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase().trim();
                      const name = `${student.firstName} ${student.surname}`.toLowerCase();
                      const sId = (student.studentId || '').toLowerCase();
                      return name.includes(q) || sId.includes(q);
                    }
                    return true;
                  })
                  .map(({ student, status }, idx) => (
                    <tr key={`sch_hst_${student.id}_${student.studentId || ''}_${idx}`} className="hover:bg-slate-700/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">
                        {student.firstName} {student.surname}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        {student.studentId}
                      </td>
                      <td className="py-3.5 px-4 font-medium">{student.currentClass}</td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {status.residenceType === 'hostel' ? (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold inline-flex items-center gap-1">
                              🛏️ Boarder
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px]">
                              🏠 Day
                            </span>
                          )}
                          {status.scholarshipType !== 'none' && (
                            <span className="block text-[10px] text-emerald-400 font-semibold truncate max-w-[140px]">
                              🎓 {status.scholarshipLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        ₦{status.netRequiredFee.toLocaleString()}
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => openAdjustModal(student)}
                            className="px-2 py-1 bg-indigo-900/40 hover:bg-indigo-800 text-indigo-300 rounded text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 border border-indigo-600/30"
                            title="Configure Scholarship & Hostel"
                          >
                            <Award className="w-3 h-3 text-amber-400" />
                            Category
                          </button>
                          <button
                            onClick={() => openPaymentModal(student)}
                            className="px-2 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold transition cursor-pointer"
                          >
                            + Input Fee
                          </button>
                          <button
                            onClick={() => openEditFeeModal(student)}
                            className="px-2 py-1 bg-amber-900/40 hover:bg-amber-800 text-amber-300 rounded text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 border border-amber-600/30"
                            title="Edit fee record in case of wrong entry"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit Fee
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
                    min="0"
                    step="any"
                    required
                    value={paymentModal.amountToInput}
                    onChange={(e) =>
                      setPaymentModal((prev) => ({ ...prev, amountToInput: e.target.value }))
                    }
                    placeholder="e.g. 50000 (Enter any amount)"
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

      {/* MODAL: EDIT / CORRECT RECORDED STUDENT FEE (IN CASE OF WRONG ENTRY) */}
      {editFeeModal.isOpen && editFeeModal.student && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <Pencil className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Edit / Correct Fee Record</h3>
              </div>
              <button
                onClick={() => setEditFeeModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                Correction Mode: Adjust or fix any mistakenly entered payment amount. The new total cumulative paid amount will replace the wrong record on all ledgers.
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Scholar Name:</span>
                <strong className="text-white text-sm">
                  {editFeeModal.student.firstName} {editFeeModal.student.surname}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Admission ID:</span>
                <strong className="text-emerald-400 font-mono">{editFeeModal.student.studentId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Class:</span>
                <strong className="text-white">{editFeeModal.student.currentClass}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Class Required Fee:</span>
                <strong className="text-amber-300 font-mono">
                  ₦{(classFees[editFeeModal.student.currentClass] || 150000).toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-medium">Currently Recorded Paid:</span>
                <strong className="text-rose-400 font-mono font-bold">
                  ₦{editFeeModal.currentPaid.toLocaleString()}
                </strong>
              </div>
            </div>

            <form onSubmit={handleSubmitEditFee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Corrected Total Cumulative Amount Paid (NGN) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400 font-mono">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editFeeModal.correctedAmount}
                    onChange={(e) =>
                      setEditFeeModal((prev) => ({ ...prev, correctedAmount: e.target.value }))
                    }
                    placeholder="Enter any amount (e.g. 0 or corrected sum)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Enter 0 if the payment was mistakenly attributed to this scholar.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correction Reason / Audit Note *
                </label>
                <input
                  type="text"
                  required
                  value={editFeeModal.note}
                  onChange={(e) =>
                    setEditFeeModal((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="e.g. Correction of wrong entry by Bursar"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reference / Correction Voucher ID
                </label>
                <input
                  type="text"
                  value={editFeeModal.receiptNo}
                  onChange={(e) =>
                    setEditFeeModal((prev) => ({ ...prev, receiptNo: e.target.value }))
                  }
                  placeholder="CORR-12345"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditFeeModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-amber-950 cursor-pointer"
                >
                  Save Corrected Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE SCHOLARSHIP SUBSIDY & HOSTEL ACCOMMODATION */}
      {adjustModal.isOpen && adjustModal.student && (() => {
        const targetStudent = adjustModal.student;
        const targetClass = targetStudent.currentClass;
        const baseClassFee = classFees[targetClass] !== undefined
          ? classFees[targetClass]
          : (DEFAULT_CLASS_FEES[targetClass] || 150000);

        const isHostel = adjustModal.residenceType === 'hostel';
        const customHostelVal = adjustModal.customHostelFee.trim() !== ''
          ? Math.max(0, parseFloat(adjustModal.customHostelFee) || 0)
          : hostelFee;
        const effectiveHostelFee = isHostel ? customHostelVal : 0;

        const grossFee = baseClassFee + effectiveHostelFee;

        let calculatedDiscount = 0;
        const appliesToAll = adjustModal.scholarshipAppliesTo === 'all_fees';
        const baseForDiscount = appliesToAll ? grossFee : baseClassFee;

        if (adjustModal.scholarshipType === 'full') {
          calculatedDiscount = baseForDiscount;
        } else if (adjustModal.scholarshipType === 'half') {
          calculatedDiscount = Math.round(baseForDiscount * 0.5);
        } else if (adjustModal.scholarshipType === 'percentage') {
          const pct = Math.min(100, Math.max(0, parseFloat(adjustModal.scholarshipPercentage) || 0));
          calculatedDiscount = Math.round(baseForDiscount * (pct / 100));
        } else if (adjustModal.scholarshipType === 'fixed') {
          const amt = Math.max(0, parseFloat(adjustModal.scholarshipAmount) || 0);
          calculatedDiscount = Math.min(grossFee, amt);
        }

        const netRequiredBill = Math.max(0, grossFee - calculatedDiscount);
        const sId = (targetStudent.studentId || String(targetStudent.id)).toUpperCase();
        const currentPaidVal = payments[sId]?.amountPaid || 0;
        const projectedBalance = Math.max(0, netRequiredBill - currentPaidVal);

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative my-8 animate-in fade-in zoom-in-95">
              <button
                onClick={() => setAdjustModal((prev) => ({ ...prev, isOpen: false }))}
                className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Scholarship & Hostel Category Configuration
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure accommodation status and scholarship fee subsidies for this scholar.
                  </p>
                </div>
              </div>

              {/* Scholar Identification Card */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 mb-5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Scholar</span>
                  <strong className="text-white text-sm">
                    {targetStudent.firstName} {targetStudent.surname}
                  </strong>
                  <span className="text-[11px] text-emerald-400 font-mono block mt-0.5">
                    {targetStudent.studentId} • Class {targetClass}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Base Class Tuition</span>
                  <strong className="text-amber-300 font-mono text-sm">
                    ₦{baseClassFee.toLocaleString()}
                  </strong>
                </div>
              </div>

              <form onSubmit={handleSaveAdjustment} className="space-y-5">
                {/* 1. RESIDENCE STATUS (HOSTEL VS DAY) */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    1. Residence & Boarding Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAdjustModal((prev) => ({ ...prev, residenceType: 'day' }))}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        adjustModal.residenceType === 'day'
                          ? 'bg-slate-800 border-amber-500/80 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-slate-300" />
                        <span className="font-bold text-white text-xs">Day Scholar</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        Standard class tuition only (no accommodation fee added).
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustModal((prev) => ({ ...prev, residenceType: 'hostel' }))}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        adjustModal.residenceType === 'hostel'
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-md text-white'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BedDouble className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-white text-xs">Boarder (Hostel)</span>
                      </div>
                      <span className="text-[10px] text-indigo-300/80 mt-2 block">
                        Hostel resident (+₦{effectiveHostelFee.toLocaleString()} term fee).
                      </span>
                    </button>
                  </div>

                  {/* Custom Hostel Fee Override (Optional) */}
                  {adjustModal.residenceType === 'hostel' && (
                    <div className="bg-indigo-950/30 p-3 rounded-xl border border-indigo-500/30 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-indigo-300 font-semibold text-[11px]">
                          Hostel Fee Amount (NGN)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Leave blank to use default school rate (₦{hostelFee.toLocaleString()})
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-bold text-slate-400 font-mono text-xs">₦</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={adjustModal.customHostelFee}
                          onChange={(e) => setAdjustModal((prev) => ({ ...prev, customHostelFee: e.target.value }))}
                          placeholder={String(hostelFee)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. SCHOLARSHIP & FEE SUBSIDY */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    2. Scholarship & Tuition Subsidy
                  </label>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                    {[
                      { id: 'none', label: 'None', desc: '0% Subsidy' },
                      { id: 'half', label: '50% Half', desc: 'Half Waiver' },
                      { id: 'full', label: '100% Full', desc: 'Full Waiver' },
                      { id: 'percentage', label: 'Custom %', desc: 'Specific %' },
                      { id: 'fixed', label: 'Fixed ₦', desc: 'Specific ₦' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAdjustModal((prev) => ({ ...prev, scholarshipType: opt.id as any }))}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          adjustModal.scholarshipType === opt.id
                            ? 'bg-emerald-950 border-emerald-500 text-white font-bold shadow'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="block text-xs">{opt.label}</span>
                        <span className="text-[9px] opacity-75 font-normal block mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Percentage Input */}
                  {adjustModal.scholarshipType === 'percentage' && (
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 animate-in fade-in">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Subsidy Percentage (1% - 100%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={adjustModal.scholarshipPercentage}
                          onChange={(e) => setAdjustModal((prev) => ({ ...prev, scholarshipPercentage: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                          placeholder="e.g. 25"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
                      </div>
                    </div>
                  )}

                  {/* Fixed Amount Input */}
                  {adjustModal.scholarshipType === 'fixed' && (
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 animate-in fade-in">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Fixed Discount / Subsidy Grant (NGN)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-bold text-slate-400 font-mono text-xs">₦</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={adjustModal.scholarshipAmount}
                          onChange={(e) => setAdjustModal((prev) => ({ ...prev, scholarshipAmount: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                          placeholder="e.g. 50000"
                        />
                      </div>
                    </div>
                  )}

                  {/* Scholarship Name & Scope */}
                  {adjustModal.scholarshipType !== 'none' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Scholarship / Award Program Name
                        </label>
                        <input
                          type="text"
                          value={adjustModal.scholarshipName}
                          onChange={(e) => setAdjustModal((prev) => ({ ...prev, scholarshipName: e.target.value }))}
                          placeholder="e.g. Founder's Academic Award"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Subsidy Scope
                        </label>
                        <select
                          value={adjustModal.scholarshipAppliesTo}
                          onChange={(e) => setAdjustModal((prev) => ({ ...prev, scholarshipAppliesTo: e.target.value as any }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="tuition_only">Tuition Only (Hostel still billed)</option>
                          <option value="all_fees">All Fees (Covers Tuition & Hostel)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. LIVE FINANCIAL SUMMARY PREVIEW */}
                <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-4 space-y-2 text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block border-b border-slate-800 pb-1.5">
                    Live Real-Time Billing Preview
                  </span>

                  <div className="flex justify-between text-slate-300">
                    <span>Base Class Tuition:</span>
                    <span className="font-mono">₦{baseClassFee.toLocaleString()}</span>
                  </div>

                  {effectiveHostelFee > 0 && (
                    <div className="flex justify-between text-indigo-300">
                      <span>Boarding & Hostel Accommodation:</span>
                      <span className="font-mono font-semibold">+₦{effectiveHostelFee.toLocaleString()}</span>
                    </div>
                  )}

                  {calculatedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Scholarship Subsidy Discount:</span>
                      <span className="font-mono">-₦{calculatedDiscount.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-white text-sm">
                    <span>Net Bill Payable:</span>
                    <span className="font-mono text-amber-300">₦{netRequiredBill.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between text-emerald-400">
                    <span>Total Paid to Date:</span>
                    <span className="font-mono">₦{currentPaidVal.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between border-t border-slate-800 pt-1.5 font-black text-sm">
                    <span className={projectedBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                      Projected Outstanding Balance:
                    </span>
                    <span className={`font-mono text-base ${projectedBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ₦{projectedBalance.toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-1 text-[11px] text-slate-400">
                    Status Outcome:{' '}
                    {projectedBalance <= 0 ? (
                      <span className="text-emerald-400 font-bold">🟢 Fully Cleared (Result locks lifted automatically)</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">⚠️ Debtor Balance Due (Bursary clearance pending)</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustModal((prev) => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-lg shadow-amber-950 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Save Category & Update Ledger
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

import { FeeLockRecord, StudentPaymentRecord, Student, StudentFeeAdjustment } from '../types/index.ts';

const FEE_LOCKS_STORAGE_KEY = 'fis_student_fee_locks_v1';
const CLASS_FEES_STORAGE_KEY = 'fis_class_fees_config_v1';
const STUDENT_PAYMENTS_STORAGE_KEY = 'fis_student_payments_v1';
const HOSTEL_FEE_STORAGE_KEY = 'fis_hostel_fee_config_v1';
const FEE_ADJUSTMENTS_STORAGE_KEY = 'fis_student_fee_adjustments_v1';

export const DEFAULT_HOSTEL_FEE = 80000; // ₦80,000 per term for Boarding / Hostel accommodation

export const DEFAULT_CLASS_FEES: Record<string, number> = {
  'Creche': 95000,
  'KG 1': 100000,
  'KG 2': 100000,
  'NUR 1': 110000,
  'NUR 2': 110000,
  'Primary 1': 115000,
  'Primary 2': 115000,
  'Primary 3': 120000,
  'Primary 4': 120000,
  'Primary 5': 125000,
  'JSS 1': 150000,
  'JSS 2': 150000,
  'JSS 3': 160000,
  'SSS 1': 180000,
  'SSS 2': 180000,
  'SS 3': 220000,
  // Backwards compatibility aliases
  'SS 1': 180000,
  'SS 2': 180000,
};

// ----------------------------------------------------
// 1. FEE LOCKS (Withholding Terminal Academic Reports)
// ----------------------------------------------------
export function getAllFeeLocks(): Record<string, FeeLockRecord> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(FEE_LOCKS_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function isStudentFeeLocked(studentIdOrIdentifier?: string | number | null): boolean {
  if (!studentIdOrIdentifier) return false;
  const key = String(studentIdOrIdentifier).trim().toUpperCase();
  const locks = getAllFeeLocks();
  if (!locks || typeof locks !== 'object') return false;
  return Boolean(locks[key]?.locked);
}

export function getStudentFeeLockDetails(studentIdOrIdentifier?: string | number | null): FeeLockRecord | null {
  if (!studentIdOrIdentifier) return null;
  const key = String(studentIdOrIdentifier).trim().toUpperCase();
  const locks = getAllFeeLocks();
  if (!locks || typeof locks !== 'object') return null;
  return locks[key] || null;
}

export async function setStudentFeeLock(
  studentId: string,
  locked: boolean,
  options?: {
    studentDbId?: number;
    reason?: string;
    balance?: string;
    updatedBy?: string;
    token?: string | null;
  }
): Promise<FeeLockRecord> {
  const cleanId = studentId.trim().toUpperCase();
  const currentLocks = getAllFeeLocks();

  const record: FeeLockRecord = {
    studentId: cleanId,
    studentDbId: options?.studentDbId,
    locked,
    reason: options?.reason || (locked ? 'Outstanding school fees unpaid' : 'Cleared by Bursary'),
    balance: options?.balance || '',
    updatedBy: options?.updatedBy || 'Bursar',
    updatedAt: new Date().toISOString(),
  };

  currentLocks[cleanId] = record;
  if (options?.studentDbId) {
    currentLocks[String(options.studentDbId)] = record;
  }

  try {
    localStorage.setItem(FEE_LOCKS_STORAGE_KEY, JSON.stringify(currentLocks));
  } catch (_) {}

  // Dispatch event so UI updates immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fis:fee-locks-updated', {
        detail: { studentId: cleanId, locked, record },
      })
    );
  }

  // Attempt backend persistence
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options?.token) headers['Authorization'] = `Bearer ${options.token}`;
    await fetch('/api/bursar/lock-student', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentId: cleanId,
        locked,
        reason: record.reason,
        balance: record.balance,
      }),
    });
  } catch (err) {
    console.warn('Backend fee lock deferred:', err);
  }

  return record;
}

// ----------------------------------------------------
// 2. CLASS FEE AMOUNTS (Configurable per Class)
// ----------------------------------------------------
export function getAllClassFees(): Record<string, number> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CLASS_FEES_STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_CLASS_FEES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CLASS_FEES, ...parsed };
  } catch (_) {
    return { ...DEFAULT_CLASS_FEES };
  }
}

export function getClassFee(currentClass: string): number {
  const fees = getAllClassFees();
  const match = Object.keys(fees).find(
    (k) => k.toLowerCase() === currentClass.toLowerCase().trim()
  );
  if (match) return fees[match];

  // Try matching abbreviations
  const clean = currentClass.toUpperCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(fees)) {
    if (k.toUpperCase().replace(/\s+/g, '') === clean) return v;
  }

  return 150000; // Default baseline fee
}

export async function setClassFee(
  classLevel: string,
  amount: number,
  token?: string | null
): Promise<Record<string, number>> {
  const fees = getAllClassFees();
  fees[classLevel] = Math.max(0, amount);

  try {
    localStorage.setItem(CLASS_FEES_STORAGE_KEY, JSON.stringify(fees));
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fis:bursar-data-updated', { detail: { fees } }));
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch('/api/bursar/class-fees', {
      method: 'POST',
      headers,
      body: JSON.stringify({ classFees: fees }),
    });
  } catch (_) {}

  return fees;
}

export async function saveAllClassFees(
  newFees: Record<string, number>,
  token?: string | null
): Promise<Record<string, number>> {
  try {
    localStorage.setItem(CLASS_FEES_STORAGE_KEY, JSON.stringify(newFees));
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fis:bursar-data-updated', { detail: { fees: newFees } }));
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch('/api/bursar/class-fees', {
      method: 'POST',
      headers,
      body: JSON.stringify({ classFees: newFees }),
    });
  } catch (_) {}

  return newFees;
}

// ----------------------------------------------------
// 2B. HOSTEL / BOARDING FEES & SCHOLARSHIP ADJUSTMENTS
// ----------------------------------------------------
export function getHostelFee(): number {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(HOSTEL_FEE_STORAGE_KEY) : null;
    if (!raw) return DEFAULT_HOSTEL_FEE;
    const num = parseFloat(raw);
    return isNaN(num) ? DEFAULT_HOSTEL_FEE : Math.max(0, num);
  } catch (_) {
    return DEFAULT_HOSTEL_FEE;
  }
}

export async function setHostelFee(amount: number, token?: string | null): Promise<number> {
  const cleanAmount = Math.max(0, amount);
  try {
    localStorage.setItem(HOSTEL_FEE_STORAGE_KEY, String(cleanAmount));
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fis:bursar-data-updated', { detail: { hostelFee: cleanAmount } }));
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch('/api/bursar/hostel-fee', {
      method: 'POST',
      headers,
      body: JSON.stringify({ hostelFee: cleanAmount }),
    });
  } catch (_) {}

  return cleanAmount;
}

export function getAllFeeAdjustments(): Record<string, StudentFeeAdjustment> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(FEE_ADJUSTMENTS_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function getStudentFeeAdjustment(
  studentIdOrIdentifier?: string | number | null
): StudentFeeAdjustment | null {
  if (!studentIdOrIdentifier) return null;
  const key = String(studentIdOrIdentifier).trim().toUpperCase();
  const all = getAllFeeAdjustments();
  return all[key] || null;
}

export async function setStudentFeeAdjustment(
  studentId: string,
  adjustment: Partial<StudentFeeAdjustment>,
  options?: {
    currentClass?: string;
    studentDbId?: number;
    token?: string | null;
    updatedBy?: string;
  }
): Promise<StudentFeeAdjustment> {
  const cleanId = studentId.trim().toUpperCase();
  const all = getAllFeeAdjustments();
  const existing = all[cleanId] || {
    studentId: cleanId,
    residenceType: 'day',
    scholarshipType: 'none',
  };

  const updated: StudentFeeAdjustment = {
    ...existing,
    ...adjustment,
    studentId: cleanId,
    studentDbId: options?.studentDbId || existing.studentDbId,
    updatedBy: options?.updatedBy || existing.updatedBy || 'Bursar',
    updatedAt: new Date().toISOString(),
  };

  all[cleanId] = updated;
  if (options?.studentDbId) {
    all[String(options.studentDbId)] = updated;
  }

  try {
    localStorage.setItem(FEE_ADJUSTMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fis:bursar-data-updated', {
        detail: { studentId: cleanId, adjustment: updated },
      })
    );
  }

  // Attempt backend persistence
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options?.token) headers['Authorization'] = `Bearer ${options.token}`;
    await fetch('/api/bursar/fee-adjustments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentId: cleanId,
        adjustment: updated,
      }),
    });
  } catch (err) {
    console.warn('Backend fee adjustment deferred:', err);
  }

  return updated;
}

export function calculateStudentFeeBreakdown(
  student: Student,
  classFeesMap: Record<string, number> = {},
  adjustmentsMap: Record<string, StudentFeeAdjustment> = {},
  defaultHostelFeeAmount?: number
) {
  const sId = (student.studentId || String(student.id)).trim().toUpperCase();
  const baseClassFee = classFeesMap[student.currentClass] !== undefined
    ? classFeesMap[student.currentClass]
    : getClassFee(student.currentClass);

  const adj = adjustmentsMap[sId] || adjustmentsMap[String(student.id)] || {
    residenceType: (student.residenceType || 'day') as 'day' | 'hostel',
    scholarshipType: (student.scholarshipType || 'none') as any,
    scholarshipPercentage: student.scholarshipPercentage,
    scholarshipAmount: student.scholarshipAmount,
    scholarshipName: student.scholarshipName,
    hostelFee: student.hostelFee,
  };

  const isHostel = adj.residenceType === 'hostel';
  const effectiveHostelFee = isHostel
    ? (adj.hostelFee !== undefined && adj.hostelFee !== null ? adj.hostelFee : (defaultHostelFeeAmount !== undefined ? defaultHostelFeeAmount : getHostelFee()))
    : 0;

  const grossFee = baseClassFee + effectiveHostelFee;

  let scholarshipDiscount = 0;
  let scholarshipLabel = 'No Scholarship';
  const appliesToAll = adj.scholarshipAppliesTo === 'all_fees';
  const baseForDiscount = appliesToAll ? grossFee : baseClassFee;

  if (adj.scholarshipType === 'full') {
    scholarshipDiscount = baseForDiscount;
    scholarshipLabel = '100% Full Scholarship (Free Tuition)';
  } else if (adj.scholarshipType === 'half') {
    scholarshipDiscount = Math.round(baseForDiscount * 0.5);
    scholarshipLabel = '50% Half Scholarship (Tuition Subsidized)';
  } else if (adj.scholarshipType === 'percentage') {
    const pct = Math.min(100, Math.max(0, adj.scholarshipPercentage || 0));
    scholarshipDiscount = Math.round(baseForDiscount * (pct / 100));
    scholarshipLabel = `${pct}% Scholarship Subsidy`;
  } else if (adj.scholarshipType === 'fixed') {
    const amt = Math.max(0, adj.scholarshipAmount || 0);
    scholarshipDiscount = Math.min(grossFee, amt);
    scholarshipLabel = `₦${amt.toLocaleString()} Subsidy Grant`;
  }

  const netRequiredFee = Math.max(0, grossFee - scholarshipDiscount);

  return {
    baseClassFee,
    hostelFee: effectiveHostelFee,
    grossFee,
    scholarshipDiscount,
    netRequiredFee,
    residenceType: adj.residenceType || 'day',
    scholarshipType: adj.scholarshipType || 'none',
    scholarshipPercentage: adj.scholarshipPercentage,
    scholarshipAmount: adj.scholarshipAmount,
    scholarshipName: adj.scholarshipName,
    scholarshipLabel,
  };
}

// ----------------------------------------------------
// 3. STUDENT FEE PAYMENTS & DEBTOR BALANCE CALCULATION
// ----------------------------------------------------
export function getAllStudentPayments(): Record<string, StudentPaymentRecord> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STUDENT_PAYMENTS_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function getStudentPayment(studentId?: string | number | null): StudentPaymentRecord | null {
  if (!studentId) return null;
  const clean = String(studentId).trim().toUpperCase();
  const all = getAllStudentPayments();
  return all[clean] || null;
}

export async function recordStudentPayment(
  studentId: string,
  amount: number,
  options?: {
    isAddition?: boolean;
    receiptNo?: string;
    note?: string;
    updatedBy?: string;
    studentDbId?: number;
    currentClass?: string;
    token?: string | null;
  }
): Promise<StudentPaymentRecord> {
  const cleanId = studentId.trim().toUpperCase();
  const all = getAllStudentPayments();
  const existing = all[cleanId];

  const currentAmount = existing ? existing.amountPaid : 0;
  const newAmount = options?.isAddition ? currentAmount + amount : amount;

  const now = new Date().toISOString();
  const paymentEntry = {
    id: `PMT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    amount,
    date: now,
    receiptNo: options?.receiptNo || `REC-${Date.now().toString().slice(-6)}`,
    note: options?.note || (options?.isAddition ? 'Installment payment received' : 'Payment record updated'),
    recordedBy: options?.updatedBy || 'Bursar',
  };

  const updatedRecord: StudentPaymentRecord = {
    studentId: cleanId,
    studentDbId: options?.studentDbId || existing?.studentDbId,
    amountPaid: Math.max(0, newAmount),
    lastPaymentDate: now,
    history: existing?.history ? [paymentEntry, ...existing.history] : [paymentEntry],
    updatedAt: now,
  };

  all[cleanId] = updatedRecord;
  if (options?.studentDbId) {
    all[String(options.studentDbId)] = updatedRecord;
  }

  try {
    localStorage.setItem(STUDENT_PAYMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}

  // Automatically update lock status based on debtor balance if requested
  const allAdj = getAllFeeAdjustments();
  const currentClassFees = getAllClassFees();
  const studentDummy: Student = {
    id: options?.studentDbId || 0,
    studentId: cleanId,
    firstName: '',
    surname: '',
    gender: 'Other',
    currentClass: options?.currentClass || 'SS 1',
    school: 'Fenster International School',
    session: '2026/2027',
    createdAt: new Date().toISOString(),
  };
  const breakdown = calculateStudentFeeBreakdown(studentDummy, currentClassFees, allAdj);
  const requiredFee = breakdown.netRequiredFee;
  const balanceDue = Math.max(0, requiredFee - updatedRecord.amountPaid);

  if (balanceDue <= 0) {
    // Automatically lift fee lock when completely paid off
    await setStudentFeeLock(cleanId, false, {
      studentDbId: options?.studentDbId,
      reason: 'Fully cleared - All school fees paid',
      balance: '₦0',
      updatedBy: options?.updatedBy || 'Bursary Clearance',
      token: options?.token,
    });
  } else {
    // If debtor, update the recorded balance in fee lock
    const currentLock = getStudentFeeLockDetails(cleanId);
    if (currentLock?.locked) {
      await setStudentFeeLock(cleanId, true, {
        studentDbId: options?.studentDbId,
        reason: currentLock.reason || 'Outstanding tuition / school fees unpaid',
        balance: `₦${balanceDue.toLocaleString()}`,
        updatedBy: options?.updatedBy || 'Bursar',
        token: options?.token,
      });
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fis:bursar-data-updated', {
        detail: { studentId: cleanId, record: updatedRecord },
      })
    );
  }

  // Attempt backend persistence
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options?.token) headers['Authorization'] = `Bearer ${options.token}`;
    await fetch('/api/bursar/payments', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        studentId: cleanId,
        studentDbId: options?.studentDbId,
        amountPaid: updatedRecord.amountPaid,
        payment: updatedRecord,
      }),
    });
  } catch (_) {}

  return updatedRecord;
}

// ----------------------------------------------------
// 4. DEBTOR STATUS EVALUATION HELPER
// ----------------------------------------------------
export interface StudentDebtorStatus {
  requiredFee: number; // Net required fee
  baseClassFee: number;
  hostelFee: number;
  grossFee: number;
  scholarshipDiscount: number;
  netRequiredFee: number;
  amountPaid: number;
  balanceDue: number;
  isDebtor: boolean;
  isCleared: boolean;
  percentPaid: number;
  isLocked: boolean;
  residenceType: 'day' | 'hostel';
  scholarshipType: 'none' | 'full' | 'half' | 'percentage' | 'fixed';
  scholarshipPercentage?: number;
  scholarshipAmount?: number;
  scholarshipName?: string;
  scholarshipLabel: string;
}

export function evaluateStudentDebtorStatus(
  student: Student,
  classFeesMap: Record<string, number>,
  paymentsMap: Record<string, StudentPaymentRecord>,
  locksMap: Record<string, FeeLockRecord>,
  adjustmentsMap: Record<string, StudentFeeAdjustment> = {},
  customHostelFee?: number
): StudentDebtorStatus {
  const sId = (student.studentId || String(student.id)).trim().toUpperCase();

  const breakdown = calculateStudentFeeBreakdown(
    student,
    classFeesMap,
    adjustmentsMap,
    customHostelFee
  );

  const paymentRecord = paymentsMap[sId] || paymentsMap[String(student.id)];
  const amountPaid = paymentRecord ? paymentRecord.amountPaid : (student.amountPaid || 0);
  const balanceDue = Math.max(0, breakdown.netRequiredFee - amountPaid);
  const isDebtor = balanceDue > 0;
  const isCleared = balanceDue <= 0;
  const percentPaid = breakdown.netRequiredFee > 0
    ? Math.min(100, Math.round((amountPaid / breakdown.netRequiredFee) * 100))
    : 100;
  const isLocked = Boolean(locksMap[sId]?.locked || locksMap[String(student.id)]?.locked);

  return {
    requiredFee: breakdown.netRequiredFee,
    baseClassFee: breakdown.baseClassFee,
    hostelFee: breakdown.hostelFee,
    grossFee: breakdown.grossFee,
    scholarshipDiscount: breakdown.scholarshipDiscount,
    netRequiredFee: breakdown.netRequiredFee,
    amountPaid,
    balanceDue,
    isDebtor,
    isCleared,
    percentPaid,
    isLocked,
    residenceType: breakdown.residenceType as 'day' | 'hostel',
    scholarshipType: breakdown.scholarshipType as any,
    scholarshipPercentage: breakdown.scholarshipPercentage,
    scholarshipAmount: breakdown.scholarshipAmount,
    scholarshipName: breakdown.scholarshipName,
    scholarshipLabel: breakdown.scholarshipLabel,
  };
}

import { FeeLockRecord, StudentPaymentRecord, Student } from '../types/index.ts';

const FEE_LOCKS_STORAGE_KEY = 'fis_student_fee_locks_v1';
const CLASS_FEES_STORAGE_KEY = 'fis_class_fees_config_v1';
const STUDENT_PAYMENTS_STORAGE_KEY = 'fis_student_payments_v1';

export const DEFAULT_CLASS_FEES: Record<string, number> = {
  'Primary 5': 120000,
  'JSS 1': 150000,
  'JSS 2': 150000,
  'JSS 3': 160000,
  'SS 1': 180000,
  'SS 2': 180000,
  'SS 3': 220000,
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

export function getStudentPayment(studentId: string): StudentPaymentRecord | null {
  const clean = studentId.trim().toUpperCase();
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

  try {
    localStorage.setItem(STUDENT_PAYMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}

  // Automatically update lock status based on debtor balance if requested
  const requiredFee = options?.currentClass ? getClassFee(options.currentClass) : 150000;
  const balanceDue = requiredFee - updatedRecord.amountPaid;

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
  requiredFee: number;
  amountPaid: number;
  balanceDue: number;
  isDebtor: boolean;
  isCleared: boolean;
  percentPaid: number;
  isLocked: boolean;
}

export function evaluateStudentDebtorStatus(
  student: Student,
  classFeesMap: Record<string, number>,
  paymentsMap: Record<string, StudentPaymentRecord>,
  locksMap: Record<string, FeeLockRecord>
): StudentDebtorStatus {
  const sId = (student.studentId || String(student.id)).trim().toUpperCase();
  const requiredFee = classFeesMap[student.currentClass] !== undefined
    ? classFeesMap[student.currentClass]
    : getClassFee(student.currentClass);

  const paymentRecord = paymentsMap[sId];
  const amountPaid = paymentRecord ? paymentRecord.amountPaid : 0;
  const balanceDue = Math.max(0, requiredFee - amountPaid);
  const isDebtor = balanceDue > 0;
  const isCleared = balanceDue <= 0;
  const percentPaid = requiredFee > 0 ? Math.min(100, Math.round((amountPaid / requiredFee) * 100)) : 100;
  const isLocked = Boolean(locksMap[sId]?.locked);

  return {
    requiredFee,
    amountPaid,
    balanceDue,
    isDebtor,
    isCleared,
    percentPaid,
    isLocked,
  };
}

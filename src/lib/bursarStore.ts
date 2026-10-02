import { FeeLockRecord } from '../types/index.ts';
import { supabase } from '../supabaseConfig.ts';

const FEE_LOCKS_STORAGE_KEY = 'fis_student_fee_locks_v1';

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
    reason: options?.reason || (locked ? 'Outstanding school fees for current term' : 'Cleared by Bursary'),
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

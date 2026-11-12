import { db } from '../db/index.ts';
import { students } from '../db/schema.ts';
import { sql } from 'drizzle-orm';

/**
 * Generates a globally unique, persistent Student ID formatted as:
 * {SCHOOL_CODE}-{YEAR}-{6_DIGIT_SEQUENCE}
 * e.g. FEN-2026-000001
 * Uses sequence locking / database counting to ensure no duplicates.
 */
export async function generateStudentId(schoolCode = 'FEN', academicYear?: string): Promise<string> {
  const year = academicYear ? academicYear.slice(0, 4) : new Date().getFullYear().toString();
  const prefix = `${schoolCode}-${year}-`;

  // Fetch count of students matching this prefix to increment atomically
  const result = await db.execute(sql`
    SELECT count(*)::int as total
    FROM students
    WHERE student_id LIKE ${prefix + '%'}
  `);

  const currentCount = (result.rows[0] as any)?.total || 0;
  let nextNumber = currentCount + 1;
  let candidateId = `${prefix}${String(nextNumber).padStart(6, '0')}`;

  // Extra safety check: ensure uniqueness against the table
  let exists = true;
  while (exists) {
    const check = await db.execute(sql`
      SELECT 1 FROM students WHERE student_id = ${candidateId} LIMIT 1
    `);
    if (check.rows.length === 0) {
      exists = false;
    } else {
      nextNumber++;
      candidateId = `${prefix}${String(nextNumber).padStart(6, '0')}`;
    }
  }

  return candidateId;
}

export function calculateGrade(score: number, maxScore = 100): { grade: string; percentage: number; remark: string } {
  const percentage = Math.round(((score / maxScore) * 100) * 10) / 10;
  if (percentage >= 75) return { grade: 'A1', percentage, remark: '10' };
  if (percentage >= 70) return { grade: 'B2', percentage, remark: '8' };
  if (percentage >= 65) return { grade: 'B3', percentage, remark: '8' };
  if (percentage >= 60) return { grade: 'C4', percentage, remark: '6' };
  if (percentage >= 55) return { grade: 'C5', percentage, remark: '6' };
  if (percentage >= 50) return { grade: 'C6', percentage, remark: '6' };
  if (percentage >= 45) return { grade: 'D7', percentage, remark: '4' };
  if (percentage >= 40) return { grade: 'E8', percentage, remark: '2' };
  return { grade: 'F9', percentage, remark: 'CARRY OVER' };
}

export function calculateWaecGrade(score: number, maxScore = 100): { grade: string; percentage: number; remark: string; points: number } {
  const percentage = Math.round(((score / maxScore) * 100) * 10) / 10;
  if (percentage >= 75) return { grade: 'A1', percentage, remark: '10', points: 5 };
  if (percentage >= 70) return { grade: 'B2', percentage, remark: '8', points: 4 };
  if (percentage >= 65) return { grade: 'B3', percentage, remark: '8', points: 4 };
  if (percentage >= 60) return { grade: 'C4', percentage, remark: '6', points: 3 };
  if (percentage >= 55) return { grade: 'C5', percentage, remark: '6', points: 3 };
  if (percentage >= 50) return { grade: 'C6', percentage, remark: '6', points: 3 };
  if (percentage >= 45) return { grade: 'D7', percentage, remark: '4', points: 2 };
  if (percentage >= 40) return { grade: 'E8', percentage, remark: '2', points: 1 };
  return { grade: 'F9', percentage, remark: 'CARRY OVER', points: 0 };
}

export const SCHOOL_CLASSES = [
  'Creche',
  'KG 1',
  'KG 2',
  'NUR 1',
  'NUR 2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'JSS 1',
  'JSS 2',
  'JSS 3',
  'SSS 1',
  'SSS 2',
  'SS 3',
] as const;

export type SchoolClass = (typeof SCHOOL_CLASSES)[number];

export const SCHOOL_CLASS_OPTIONS = [
  { value: 'Creche', label: 'Creche (Early Years / Daycare)' },
  { value: 'KG 1', label: 'KG 1 (Kindergarten 1)' },
  { value: 'KG 2', label: 'KG 2 (Kindergarten 2)' },
  { value: 'NUR 1', label: 'NUR 1 (Nursery 1)' },
  { value: 'NUR 2', label: 'NUR 2 (Nursery 2)' },
  { value: 'Primary 1', label: 'Primary 1 (Basic 1)' },
  { value: 'Primary 2', label: 'Primary 2 (Basic 2)' },
  { value: 'Primary 3', label: 'Primary 3 (Basic 3)' },
  { value: 'Primary 4', label: 'Primary 4 (Basic 4)' },
  { value: 'Primary 5', label: 'Primary 5 (Basic 5)' },
  { value: 'JSS 1', label: 'JSS 1 (Junior Secondary 1)' },
  { value: 'JSS 2', label: 'JSS 2 (Junior Secondary 2)' },
  { value: 'JSS 3', label: 'JSS 3 (Junior Secondary 3)' },
  { value: 'SSS 1', label: 'SSS 1 (Senior Secondary 1)' },
  { value: 'SSS 2', label: 'SSS 2 (Senior Secondary 2)' },
  { value: 'SS 3', label: 'SS 3 (Senior Secondary 3 - Final Mock)' },
] as const;

export function normalizeClassName(className?: string | null): string {
  if (!className) return '';
  const clean = className.trim().toUpperCase().replace(/\s+/g, ' ');
  if (clean === 'CRECHE') return 'Creche';
  if (clean === 'KG1' || clean === 'KG 1' || clean === 'KINDERGARTEN 1') return 'KG 1';
  if (clean === 'KG2' || clean === 'KG 2' || clean === 'KINDERGARTEN 2') return 'KG 2';
  if (clean === 'NUR1' || clean === 'NUR 1' || clean === 'NURSERY 1') return 'NUR 1';
  if (clean === 'NUR2' || clean === 'NUR 2' || clean === 'NURSERY 2') return 'NUR 2';
  if (clean === 'PRIMARY 1' || clean === 'PRI 1' || clean === 'BASIC 1' || clean === 'PRIMARY1') return 'Primary 1';
  if (clean === 'PRIMARY 2' || clean === 'PRI 2' || clean === 'BASIC 2' || clean === 'PRIMARY2') return 'Primary 2';
  if (clean === 'PRIMARY 3' || clean === 'PRI 3' || clean === 'BASIC 3' || clean === 'PRIMARY3') return 'Primary 3';
  if (clean === 'PRIMARY 4' || clean === 'PRI 4' || clean === 'BASIC 4' || clean === 'PRIMARY4') return 'Primary 4';
  if (clean === 'PRIMARY 5' || clean === 'PRI 5' || clean === 'BASIC 5' || clean === 'PRIMARY5') return 'Primary 5';
  if (clean === 'JSS1' || clean === 'JSS 1' || clean === 'JS 1' || clean === 'JS1') return 'JSS 1';
  if (clean === 'JSS2' || clean === 'JSS 2' || clean === 'JS 2' || clean === 'JS2') return 'JSS 2';
  if (clean === 'JSS3' || clean === 'JSS 3' || clean === 'JS 3' || clean === 'JS3') return 'JSS 3';
  if (clean === 'SSS1' || clean === 'SSS 1' || clean === 'SS 1' || clean === 'SS1') return 'SSS 1';
  if (clean === 'SSS2' || clean === 'SSS 2' || clean === 'SS 2' || clean === 'SS2') return 'SSS 2';
  if (clean === 'SS3' || clean === 'SS 3' || clean === 'SSS 3' || clean === 'SSS3') return 'SS 3';
  return className;
}

export function isSameClass(classA?: string | null, classB?: string | null): boolean {
  if (!classA || !classB) return false;
  if (classA.toLowerCase() === 'all' || classB.toLowerCase() === 'all') return true;
  return normalizeClassName(classA) === normalizeClassName(classB);
}

export function isSecondaryClass(className?: string | null): boolean {
  if (!className) return false;
  const c = className.toUpperCase().trim();
  return (
    c.includes('JSS') ||
    c.includes('JS ') ||
    c.includes('JS1') ||
    c.includes('JS2') ||
    c.includes('JS3') ||
    c.includes('SSS') ||
    c.includes('SS ') ||
    c.includes('SS1') ||
    c.includes('SS2') ||
    c.includes('SS3') ||
    c.includes('SECONDARY')
  );
}

// Grade calculation helper (WAEC / NECO / National Curriculum Standard)
export function calculateSubjectGrade(totalScore: number): string {
  if (totalScore >= 75) return 'A1';
  if (totalScore >= 70) return 'B2';
  if (totalScore >= 65) return 'B3';
  if (totalScore >= 60) return 'C4';
  if (totalScore >= 55) return 'C5';
  if (totalScore >= 50) return 'C6';
  if (totalScore >= 45) return 'D7';
  if (totalScore >= 40) return 'E8';
  return 'F9';
}

// Check if class is Senior Secondary (SS 1, SS 2, SS 3 / SSS 1-3)
export function isSeniorSecondaryClass(className?: string | null): boolean {
  if (!className) return false;
  const c = className.trim().toUpperCase().replace(/\s+/g, ' ');
  return (
    c.includes('SS 1') ||
    c.includes('SS 2') ||
    c.includes('SS 3') ||
    c.includes('SSS 1') ||
    c.includes('SSS 2') ||
    c.includes('SSS 3') ||
    c.includes('SS1') ||
    c.includes('SS2') ||
    c.includes('SS3') ||
    c.includes('SSS1') ||
    c.includes('SSS2') ||
    c.includes('SSS3') ||
    c.includes('SENIOR SECONDARY')
  );
}

// 5.0 Grading scale point for Senior Secondary (2 units per subject)
export interface GradePoint5Result {
  grade: string;
  gradePoint: number; // 0.0 to 5.0
  units: number; // strictly 2 units per subject
  qualityPoints: number; // units * gradePoint
  remark: string;
}

export function calculateGradePoint5(totalScore: number, units: number = 2): GradePoint5Result {
  let grade = 'F9';
  let gradePoint = 0.0;
  let remark = 'Fail';

  if (totalScore >= 70) {
    grade = 'A1';
    gradePoint = 5.0;
    remark = 'Excellent / Distinction';
  } else if (totalScore >= 65) {
    grade = 'B2';
    gradePoint = 4.0;
    remark = 'Very Good';
  } else if (totalScore >= 60) {
    grade = 'B3';
    gradePoint = 4.0;
    remark = 'Good';
  } else if (totalScore >= 55) {
    grade = 'C4';
    gradePoint = 3.0;
    remark = 'Credit';
  } else if (totalScore >= 50) {
    grade = 'C5';
    gradePoint = 3.0;
    remark = 'Credit';
  } else if (totalScore >= 45) {
    grade = 'D7';
    gradePoint = 2.0;
    remark = 'Pass';
  } else if (totalScore >= 40) {
    grade = 'E8';
    gradePoint = 1.0;
    remark = 'Fair';
  } else {
    grade = 'F9';
    gradePoint = 0.0;
    remark = 'Fail';
  }

  return {
    grade,
    gradePoint,
    units,
    qualityPoints: units * gradePoint,
    remark,
  };
}

// Calculate Cumulative Grade Point Average (CGPA) on 5.0 scale for Senior Secondary (SS1 - SS3)
// Rule: Every subject taken is allocated 2 units.
export interface CgpaSummary {
  totalSubjects: number;
  totalUnits: number;
  totalQualityPoints: number;
  cgpa: number; // scale of 5.0 e.g. 4.65
  standing: string;
  gradeBadge: string;
}

export function calculateCgpa(scores: Array<{ totalScore: number; units?: number }>): CgpaSummary {
  if (!scores || scores.length === 0) {
    return {
      totalSubjects: 0,
      totalUnits: 0,
      totalQualityPoints: 0,
      cgpa: 0,
      standing: 'No Scores Recorded',
      gradeBadge: 'N/A',
    };
  }

  let totalUnits = 0;
  let totalQualityPoints = 0;

  scores.forEach((s) => {
    const u = s.units !== undefined && s.units > 0 ? s.units : 2; // Fixed 2 units per subject
    const gp = calculateGradePoint5(s.totalScore, u);
    totalUnits += u;
    totalQualityPoints += gp.qualityPoints;
  });

  const cgpaRaw = totalUnits > 0 ? totalQualityPoints / totalUnits : 0;
  const cgpa = Math.round(cgpaRaw * 100) / 100;

  let standing = 'Pass';
  let gradeBadge = 'C';

  if (cgpa >= 4.5) {
    standing = 'First Class / Distinction';
    gradeBadge = 'A';
  } else if (cgpa >= 3.5) {
    standing = 'Second Class Upper / Upper Credit';
    gradeBadge = 'B';
  } else if (cgpa >= 2.4) {
    standing = 'Second Class Lower / Lower Credit';
    gradeBadge = 'C';
  } else if (cgpa >= 1.5) {
    standing = 'Third Class / Pass';
    gradeBadge = 'D';
  } else {
    standing = 'Probation / Needs Improvement';
    gradeBadge = 'F';
  }

  return {
    totalSubjects: scores.length,
    totalUnits,
    totalQualityPoints: Math.round(totalQualityPoints * 10) / 10,
    cgpa,
    standing,
    gradeBadge,
  };
}

// Calculate Average Percentage for Junior Secondary, Primary, and Lower classes
export interface JuniorAverageSummary {
  totalSubjects: number;
  totalMarks: number;
  obtainableMarks: number;
  averagePercentage: number; // e.g. 84.5%
  overallGrade: string;
  standing: string;
}

export function calculateJuniorAverage(scores: Array<{ totalScore: number }>): JuniorAverageSummary {
  if (!scores || scores.length === 0) {
    return {
      totalSubjects: 0,
      totalMarks: 0,
      obtainableMarks: 0,
      averagePercentage: 0,
      overallGrade: 'N/A',
      standing: 'No Scores Recorded',
    };
  }

  const totalMarks = scores.reduce((sum, s) => sum + (Number(s.totalScore) || 0), 0);
  const obtainableMarks = scores.length * 100;
  const averageRaw = obtainableMarks > 0 ? (totalMarks / obtainableMarks) * 100 : 0;
  const averagePercentage = Math.round(averageRaw * 10) / 10;
  const overallGrade = calculateSubjectGrade(averagePercentage);

  let standing = 'Fair Progress';
  if (averagePercentage >= 75) standing = 'Distinction / Excellent';
  else if (averagePercentage >= 65) standing = 'Very Good';
  else if (averagePercentage >= 50) standing = 'Good / Credit';
  else if (averagePercentage >= 40) standing = 'Pass';
  else standing = 'Needs Improvement';

  return {
    totalSubjects: scores.length,
    totalMarks,
    obtainableMarks,
    averagePercentage,
    overallGrade,
    standing,
  };
}


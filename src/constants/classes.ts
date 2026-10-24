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
  'SS 1',
  'SS 2',
  'SS 3',
] as const;

export type SchoolClass = (typeof SCHOOL_CLASSES)[number];

export const CLASS_OPTIONS = SCHOOL_CLASSES;

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
  { value: 'SS 1', label: 'SS 1 (Senior Secondary 1)' },
  { value: 'SS 2', label: 'SS 2 (Senior Secondary 2)' },
  { value: 'SS 3', label: 'SS 3 (Senior Secondary 3 - Final Mock)' },
] as const;

export function normalizeClassName(className?: string | null): string {
  if (!className) return '';
  const clean = className.trim().toUpperCase().replace(/\s+/g, ' ');
  if (clean === 'CRECHE' || clean.startsWith('CRECHE')) return 'Creche';
  if (/^KG\s*1(\b|\s|[A-Z])/i.test(clean) || clean.startsWith('KINDERGARTEN 1')) return 'KG 1';
  if (/^KG\s*2(\b|\s|[A-Z])/i.test(clean) || clean.startsWith('KINDERGARTEN 2')) return 'KG 2';
  if (/^NUR\s*1(\b|\s|[A-Z])/i.test(clean) || clean.startsWith('NURSERY 1')) return 'NUR 1';
  if (/^NUR\s*2(\b|\s|[A-Z])/i.test(clean) || clean.startsWith('NURSERY 2')) return 'NUR 2';
  if (/^(PRIMARY|PRI|BASIC)\s*1(\b|\s|[A-Z])/i.test(clean)) return 'Primary 1';
  if (/^(PRIMARY|PRI|BASIC)\s*2(\b|\s|[A-Z])/i.test(clean)) return 'Primary 2';
  if (/^(PRIMARY|PRI|BASIC)\s*3(\b|\s|[A-Z])/i.test(clean)) return 'Primary 3';
  if (/^(PRIMARY|PRI|BASIC)\s*4(\b|\s|[A-Z])/i.test(clean)) return 'Primary 4';
  if (/^(PRIMARY|PRI|BASIC)\s*5(\b|\s|[A-Z])/i.test(clean)) return 'Primary 5';
  if (/^(JSS|JS)\s*1(\b|\s|[A-Z])/i.test(clean)) return 'JSS 1';
  if (/^(JSS|JS)\s*2(\b|\s|[A-Z])/i.test(clean)) return 'JSS 2';
  if (/^(JSS|JS)\s*3(\b|\s|[A-Z])/i.test(clean)) return 'JSS 3';
  if (/^(SSS|SS)\s*1(\b|\s|[A-Z])/i.test(clean)) return 'SS 1';
  if (/^(SSS|SS)\s*2(\b|\s|[A-Z])/i.test(clean)) return 'SS 2';
  if (/^(SSS|SS)\s*3(\b|\s|[A-Z])/i.test(clean)) return 'SS 3';
  return className.trim();
}

if (typeof window !== 'undefined') {
  (window as any).normalizeClassName = normalizeClassName;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).normalizeClassName = normalizeClassName;
}

export function isSameClass(classA?: string | null, classB?: string | null): boolean {
  if (!classA || !classB) return false;
  if (classA.toLowerCase() === 'all' || classB.toLowerCase() === 'all') return true;
  const normA = normalizeClassName(classA);
  const normB = normalizeClassName(classB);
  if (normA.toLowerCase() === normB.toLowerCase()) return true;
  const cleanA = classA.toLowerCase().replace(/\s+/g, '');
  const cleanB = classB.toLowerCase().replace(/\s+/g, '');
  if (cleanA === cleanB) return true;
  return false;
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

// Chronological exam stage ordering in an academic session
// 1 = First Term (1st Half / 6th-week Exam)
// 2 = First Term (Terminal Exam)
// 3 = Second Term (1st Half / 6th-week Exam)
// 4 = Second Term (Terminal Exam)
// 5 = Third Term (1st Half / 6th-week Exam)
// 6 = Third Term (Terminal Exam)
export function getExamStageOrder(
  term?: string,
  examPeriod?: string,
  title?: string,
  comment?: string
): number {
  const normTerm = (term || '').toLowerCase();
  const is1st = normTerm.includes('1') || normTerm.includes('first');
  const is2nd = normTerm.includes('2') || normTerm.includes('second');
  const is3rd = normTerm.includes('3') || normTerm.includes('third');

  let period = (examPeriod || '').toLowerCase();
  if (!period && (title || comment)) {
    const combined = `${title || ''} ${comment || ''}`.toLowerCase();
    if (
      combined.includes('first half') ||
      combined.includes('first-half') ||
      combined.includes('1st half') ||
      combined.includes('6th') ||
      combined.includes('mid')
    ) {
      period = 'first-half';
    } else {
      period = 'terminal';
    }
  }

  const isFirstHalf =
    period === 'first-half' ||
    period.includes('first half') ||
    period.includes('1st') ||
    period.includes('mid');

  if (is1st) return isFirstHalf ? 1 : 2;
  if (is2nd) return isFirstHalf ? 3 : 4;
  if (is3rd) return isFirstHalf ? 5 : 6;
  return 2;
}

// User-friendly descriptive label for cumulative scope
export function getStageScopeLabel(stage: number): string {
  switch (stage) {
    case 1:
      return '1st Half Exam';
    case 2:
      return '1st Half + Terminal';
    case 3:
      return 'Term 1 & Term 2 (1st Half)';
    case 4:
      return 'Cumulative: Term 1 & 2';
    case 5:
      return 'Terms 1, 2 & Term 3 (1st Half)';
    case 6:
      return 'Session Cumulative: Terms 1, 2 & 3';
    default:
      return 'Cumulative';
  }
}

export interface CumulativeCgpaResult {
  cgpa: number;
  totalUnits: number;
  totalQualityPoints: number;
  standing: string;
  gradeBadge: string;
  scopeLabel: string;
  qualifyingSubjectCount: number;
  cumulativeAveragePercentage: number;
}

// Compute Cumulative CGPA for a student:
// - On Terminal Exam report card: cumulative of both 1st Half and Terminal
// - For 2nd Term: cumulative of all available results up to 2nd Term (Term 1 + Term 2)
// - For 3rd Term: cumulative of all available results across the entire session (Terms 1, 2 & 3)
export function computeCumulativeCgpaForStudent(params: {
  studentDbId: string | number;
  studentIdNumber: string;
  currentStage: number; // 1 to 6
  currentStageScores: Array<{ subjectId: number | string; totalScore: number; units?: number }>;
  allLocalScores?: any[];
  allServerScores?: any[];
  targetSession?: string;
  deletedIds?: Set<string>;
}): CumulativeCgpaResult {
  const {
    studentDbId,
    studentIdNumber,
    currentStage,
    currentStageScores,
    allLocalScores = [],
    allServerScores = [],
    targetSession = '2026/2027',
    deletedIds = new Set<string>(),
  } = params;

  const cleanDbId = String(studentDbId || '').trim();
  const cleanStId = String(studentIdNumber || '').toUpperCase().trim();

  // Deduplication map: key = `${stageOrder}_${subjectId}` -> { totalScore, units }
  const stageSubjectScores = new Map<string, { totalScore: number; units: number }>();

  // 1. Current stage live scores take highest precedence
  (currentStageScores || []).forEach((item) => {
    const tot = Number(item.totalScore);
    if (!isNaN(tot) && tot > 0) {
      const sId = String(item.subjectId);
      stageSubjectScores.set(`${currentStage}_${sId}`, {
        totalScore: tot,
        units: item.units !== undefined && item.units > 0 ? item.units : 2,
      });
    }
  });

  // 2. Local broadsheet scores (fis_broadsheet_scores_v2)
  (allLocalScores || []).forEach((l: any) => {
    if (!l) return;
    const lStId = String(l.studentId || '').toUpperCase().trim();
    const lStNum = String(l.studentNumber || '').toUpperCase().trim();
    const matchesStudent =
      (lStId && (lStId === cleanDbId || lStId === cleanStId)) ||
      (lStNum && lStNum === cleanStId);
    if (!matchesStudent) return;

    // Check deleted
    if (l.id && deletedIds.has(String(l.id))) return;
    if (l.testId && deletedIds.has(String(l.testId))) return;
    if (l.examId && deletedIds.has(String(l.examId))) return;
    if (deletedIds.has(`key_${cleanDbId}_${l.subjectId}`)) return;
    if (deletedIds.has(`key_${cleanStId}_${l.subjectId}`)) return;

    // Check session
    if (l.session && targetSession && l.session.trim() !== targetSession.trim()) return;

    const lStage = getExamStageOrder(l.term, l.examPeriod);
    if (lStage <= currentStage) {
      const sId = String(l.subjectId);
      const key = `${lStage}_${sId}`;
      if (lStage < currentStage || !stageSubjectScores.has(key)) {
        const tot = Number(l.totalScore || ((l.testScore || 0) + (l.examScore || 0)));
        if (!isNaN(tot) && tot > 0) {
          stageSubjectScores.set(key, { totalScore: tot, units: 2 });
        }
      }
    }
  });

  // 3. Server assessments (/api/scores)
  (allServerScores || []).forEach((s: any) => {
    if (!s) return;
    const sDbId = String(s.studentDbId || s.studentId || '').trim();
    const sNum = String(s.studentNumber || s.studentId || '').toUpperCase().trim();
    const matchesStudent =
      (sDbId && (sDbId === cleanDbId || sDbId === cleanStId)) ||
      (sNum && (sNum === cleanStId || sNum === cleanDbId));
    if (!matchesStudent) return;

    if (s.id && deletedIds.has(String(s.id))) return;
    if (deletedIds.has(`key_${cleanDbId}_${s.subjectId}`)) return;
    if (deletedIds.has(`key_${cleanStId}_${s.subjectId}`)) return;

    if (s.session && targetSession && s.session.trim() !== targetSession.trim()) return;

    const sStage = getExamStageOrder(s.term, s.examPeriod, s.assessmentTitle, s.teacherComment);
    if (sStage <= currentStage) {
      const sId = String(s.subjectId);
      const key = `${sStage}_${sId}`;
      if (!stageSubjectScores.has(key)) {
        let tot = 0;
        if (s.teacherComment && s.teacherComment.trim().startsWith('{')) {
          try {
            const p = JSON.parse(s.teacherComment);
            if (p.totalScore !== undefined && p.totalScore !== null) tot = Number(p.totalScore);
            else if (p.caScore !== undefined || p.examScore !== undefined) {
              tot = (Number(p.caScore) || 0) + (Number(p.examScore) || 0);
            }
          } catch (_) {}
        }
        if (!tot && s.score !== undefined && s.score !== null) {
          const numS = Number(s.score);
          const maxS = Number(s.maxScore) || 100;
          if (maxS === 100) tot = numS;
          else tot = Math.round((numS / maxS) * 100);
        }
        if (!isNaN(tot) && tot > 0) {
          stageSubjectScores.set(key, { totalScore: tot, units: 2 });
        }
      }
    }
  });

  const cumulativeList = Array.from(stageSubjectScores.values());
  const scopeLabel = getStageScopeLabel(currentStage);

  if (cumulativeList.length === 0) {
    return {
      cgpa: 0,
      totalUnits: 0,
      totalQualityPoints: 0,
      standing: 'No Scores Recorded',
      gradeBadge: 'N/A',
      scopeLabel,
      qualifyingSubjectCount: 0,
      cumulativeAveragePercentage: 0,
    };
  }

  const cgpaSummary = calculateCgpa(cumulativeList);
  const totalMarks = cumulativeList.reduce((acc, curr) => acc + curr.totalScore, 0);
  const cumulativeAveragePercentage = Math.round((totalMarks / cumulativeList.length) * 10) / 10;

  return {
    cgpa: cgpaSummary.cgpa,
    totalUnits: cgpaSummary.totalUnits,
    totalQualityPoints: cgpaSummary.totalQualityPoints,
    standing: cgpaSummary.standing,
    gradeBadge: cgpaSummary.gradeBadge,
    scopeLabel,
    qualifyingSubjectCount: cumulativeList.length,
    cumulativeAveragePercentage,
  };
}




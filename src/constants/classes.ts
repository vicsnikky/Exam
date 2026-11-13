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
// Format:
// A1 = 5 point
// B2 = 4 point
// B3 = 4 point
// C4 = 3 point
// C5 = 3 point
// C6 = 3 point
// D7 = 2 point
// E8 = 1 point
// F9 = CARRY OVER
export interface GradePoint5Result {
  grade: string;
  gradePoint: number; // 0.0 to 5.0
  pointLabel: string; // gradePoint * units: '10', '8', '6', '4', '2', or 'CARRY OVER'
  units: number; // strictly 2 units per subject
  qualityPoints: number; // units * gradePoint
  remark: string;
}

export function calculateGradePoint5(totalScore: number, units: number = 2): GradePoint5Result {
  let grade = 'F9';
  let gradePoint = 0.0;
  let pointLabel = 'CARRY OVER';

  if (totalScore >= 75) {
    grade = 'A1';
    gradePoint = 5.0;
    pointLabel = String(5 * units);
  } else if (totalScore >= 70) {
    grade = 'B2';
    gradePoint = 4.0;
    pointLabel = String(4 * units);
  } else if (totalScore >= 65) {
    grade = 'B3';
    gradePoint = 4.0;
    pointLabel = String(4 * units);
  } else if (totalScore >= 60) {
    grade = 'C4';
    gradePoint = 3.0;
    pointLabel = String(3 * units);
  } else if (totalScore >= 55) {
    grade = 'C5';
    gradePoint = 3.0;
    pointLabel = String(3 * units);
  } else if (totalScore >= 50) {
    grade = 'C6';
    gradePoint = 3.0;
    pointLabel = String(3 * units);
  } else if (totalScore >= 45) {
    grade = 'D7';
    gradePoint = 2.0;
    pointLabel = String(2 * units);
  } else if (totalScore >= 40) {
    grade = 'E8';
    gradePoint = 1.0;
    pointLabel = String(1 * units);
  } else {
    grade = 'F9';
    gradePoint = 0.0;
    pointLabel = 'CARRY OVER';
  }

  return {
    grade,
    gradePoint,
    pointLabel,
    units,
    qualityPoints: units * gradePoint,
    remark: pointLabel,
  };
}

export function getGradePointLabel(gradeOrScore: string | number | null | undefined, units: number = 2): string {
  if (gradeOrScore === null || gradeOrScore === undefined || gradeOrScore === '' || gradeOrScore === '—' || gradeOrScore === '-') {
    return '—';
  }
  if (typeof gradeOrScore === 'number') {
    return calculateGradePoint5(gradeOrScore, units).pointLabel;
  }
  const g = String(gradeOrScore).trim().toUpperCase();
  if (g === 'A1' || g === 'A') return String(5 * units);
  if (g === 'B2' || g === 'B3' || g === 'B') return String(4 * units);
  if (g === 'C4' || g === 'C5' || g === 'C6' || g === 'C') return String(3 * units);
  if (g === 'D7' || g === 'D') return String(2 * units);
  if (g === 'E8' || g === 'E') return String(1 * units);
  if (g === 'F9' || g === 'F') return 'CARRY OVER';
  const num = Number(g);
  if (!isNaN(num)) {
    return calculateGradePoint5(num, units).pointLabel;
  }
  return '—';
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
  const normTerm = (term || '').toLowerCase().trim();
  const isWeekMock = normTerm.startsWith('week') || normTerm.includes('mock');
  const is1st = isWeekMock || normTerm.includes('first') || normTerm.includes('1st') || normTerm === '1';
  const is2nd = !isWeekMock && (normTerm.includes('second') || normTerm.includes('2nd') || normTerm === '2');
  const is3rd = !isWeekMock && (normTerm.includes('third') || normTerm.includes('3rd') || normTerm === '3');

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

export function getSubjectCanonicalKey(id?: number | string | null, code?: string | null, name?: string | null): string {
  const cleanId = id !== undefined && id !== null ? Number(id) : NaN;
  const n = (name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const c = (code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (n.includes('homeecon') || c === 'hec') return 'home_economics';
  if (n === 'economics' || n === 'economic' || c === 'eco') return 'economics';

  if (n.includes('furthermath') || n.includes('addmath') || c === 'fmth' || c === 'fmath') return 'further_maths';
  if (n.includes('math') || c === 'mth' || c === 'math' || c === 'maths') return 'mathematics';

  if (n.includes('literature') || c === 'lit') return 'literature';
  if (n.includes('english') || c === 'eng') return 'english';

  if (n.includes('christian') || n.includes('crs') || n.includes('crk') || c === 'crs' || c === 'crk') return 'crs';
  if (n.includes('islamic') || n.includes('irs') || n.includes('irk') || c === 'irs' || c === 'irk') return 'irs';

  if (n.includes('physical') || n.includes('health') || n === 'phe' || c === 'phe' || c === 'pe') return 'phe';

  if (n.includes('basictech') || n.includes('btech') || c === 'btech' || c === 'tech') return 'basic_technology';
  if (n.includes('basicsci') || n.includes('bst') || c === 'bst' || n.includes('integratedsci')) return 'basic_science';

  if (n.includes('cultural') || n.includes('creative') || n === 'cca' || c === 'cca' || n.includes('fineart')) return 'cca';

  if (n.includes('nationalvalue') || n === 'nve' || c === 'nve') return 'nve';
  if (n.includes('civic') || c === 'civ') return 'civic_education';
  if (n.includes('social') || c === 'sos') return 'social_studies';

  if (n.includes('computer') || n.includes('data') || n.includes('ict') || n.includes('dtech') || c === 'dtech' || c === 'ict' || c === 'cmp' || c === 'dp') return 'computer_studies';

  if (n.includes('yoruba') || c === 'yor') return 'yoruba';
  if (n.includes('igbo') || c === 'igb') return 'igbo';
  if (n.includes('hausa') || c === 'hau') return 'hausa';
  if (n.includes('french') || c === 'fre' || c === 'frc') return 'french';

  if (n.includes('biology') || c === 'bio') return 'biology';
  if (n.includes('chemistry') || c === 'chm') return 'chemistry';
  if (n.includes('physics') || c === 'phy') return 'physics';
  if (n.includes('agric') || c === 'agr') return 'agric';
  if (n.includes('commerce') || c === 'com') return 'commerce';
  if (n.includes('account') || n.includes('bookkeep') || c === 'acc') return 'accounting';
  if (n.includes('government') || c === 'gov') return 'government';
  if (n.includes('geography') || c === 'geo') return 'geography';
  if (n.includes('business') || c === 'bus') return 'business_studies';

  if (n) return n;
  if (c) return c;
  if (!isNaN(cleanId) && cleanId > 0) return `id_${cleanId}`;
  return 'unknown';
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
// - On 1st Half Exam: GPA of 1st Half Exam subjects
// - On Terminal Exam report card: cumulative of both 1st Half and Terminal (distinct exams)
// - For 2nd Term: cumulative of all available results up to 2nd Term (Term 1 + Term 2)
// - For 3rd Term: cumulative of all available results across the entire session (Terms 1, 2 & 3)
// Formula: GPA = Total Quality Points / Total Units
// where each subject has 2 Units, and Point = GradePoint (5,4,3,2,1,0) * 2
export function computeCumulativeCgpaForStudent(params: {
  studentDbId: string | number;
  studentIdNumber: string;
  currentStage: number; // 1 to 6
  currentStageScores: Array<{
    subjectId: number | string;
    subjectName?: string;
    subjectCode?: string;
    totalScore: number;
    units?: number;
  }>;
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

  // Build ID -> canonical subject key lookup so fallback IDs (500+) and DB IDs resolve to the same key
  const idToCanonical = new Map<string, string>();
  const registerCanonical = (id: any, code?: any, name?: any): string => {
    const key = getSubjectCanonicalKey(id, code, name);
    const idStr = id !== undefined && id !== null && String(id).trim() !== '' && Number(id) > 0 ? String(Number(id)) : '';
    if (idStr && key !== 'unknown' && !key.startsWith('id_')) {
      idToCanonical.set(idStr, key);
    }
    if (idStr && (key === 'unknown' || key.startsWith('id_')) && idToCanonical.has(idStr)) {
      return idToCanonical.get(idStr)!;
    }
    return key;
  };

  (currentStageScores || []).forEach((item) => {
    registerCanonical(item.subjectId, item.subjectCode, item.subjectName);
  });
  (allLocalScores || []).forEach((l: any) => {
    if (l) registerCanonical(l.subjectId, l.subjectCode, l.subjectName);
  });
  (allServerScores || []).forEach((s: any) => {
    if (s) registerCanonical(s.subjectId, s.subjectCode, s.subjectName);
  });

  const resolveCanonicalKey = (id: any, code?: any, name?: any): string => {
    const idStr = id !== undefined && id !== null && String(id).trim() !== '' && Number(id) > 0 ? String(Number(id)) : '';
    const direct = getSubjectCanonicalKey(id, code, name);
    if (direct !== 'unknown' && !direct.startsWith('id_')) {
      return direct;
    }
    if (idStr && idToCanonical.has(idStr)) {
      return idToCanonical.get(idStr)!;
    }
    return direct;
  };

  interface StageEntry {
    totalScore: number;
    units: number;
    locked?: boolean;
    ca: number | null;
    exam: number | null;
    explicitTotal: number | null;
  }

  // Deduplication map: key = `${stageOrder}_${canonicalSubjectKey}`
  const stageSubjectScores = new Map<string, StageEntry>();
  const currentStageCanonicalKeys = new Set<string>();

  // 1. Current stage live scores take highest precedence and are locked against overwrite
  (currentStageScores || []).forEach((item) => {
    const tot = Number(item.totalScore);
    if (!isNaN(tot) && tot >= 0) {
      const subKey = resolveCanonicalKey(item.subjectId, item.subjectCode, item.subjectName);
      currentStageCanonicalKeys.add(subKey);
      stageSubjectScores.set(`${currentStage}_${subKey}`, {
        totalScore: Math.min(100, tot),
        units: item.units !== undefined && item.units > 0 ? item.units : 2,
        locked: true,
        ca: null,
        exam: null,
        explicitTotal: Math.min(100, tot),
      });
    }
  });

  // 2. Local broadsheet scores (fis_broadsheet_scores_v2) for stages <= currentStage
  (allLocalScores || []).forEach((l: any) => {
    if (!l) return;
    const lStId = String(l.studentId || '').toUpperCase().trim();
    const lStNum = String(l.studentNumber || '').toUpperCase().trim();
    const matchesStudent =
      (lStId && (lStId === cleanDbId || lStId === cleanStId)) ||
      (lStNum && lStNum === cleanStId);
    if (!matchesStudent) return;

    if (l.id && deletedIds.has(String(l.id))) return;
    if (l.testId && deletedIds.has(String(l.testId))) return;
    if (l.examId && deletedIds.has(String(l.examId))) return;

    if (l.session && targetSession && l.session.trim() !== targetSession.trim()) return;

    const lStage = getExamStageOrder(l.term, l.examPeriod);
    if (lStage <= currentStage) {
      const subKey = resolveCanonicalKey(l.subjectId, l.subjectCode, l.subjectName);
      const key = `${lStage}_${subKey}`;
      // Do not overwrite locked currentStage entries, and do not fabricate duplicate earlier stage if currentStage already owns the un-periodized record
      const existing = stageSubjectScores.get(key);
      if (existing?.locked) return;
      if (!existing) {
        const tot = Number(l.totalScore ?? ((Number(l.testScore) || 0) + (Number(l.examScore) || 0)));
        if (!isNaN(tot) && tot >= 0 && (l.totalScore !== undefined || l.testScore !== undefined || l.examScore !== undefined)) {
          stageSubjectScores.set(key, {
            totalScore: Math.min(100, tot),
            units: 2,
            locked: true,
            ca: l.testScore !== undefined && l.testScore !== null ? Number(l.testScore) : null,
            exam: l.examScore !== undefined && l.examScore !== null ? Number(l.examScore) : null,
            explicitTotal: Math.min(100, tot),
          });
        }
      }
    }
  });

  // 3. Server assessments (/api/scores) for prior stages (or unpopulated entries)
  (allServerScores || []).forEach((s: any) => {
    if (!s) return;
    const sDbId = String(s.studentDbId || s.studentId || '').trim();
    const sNum = String(s.studentNumber || s.studentId || '').toUpperCase().trim();
    const matchesStudent =
      (!sDbId && !sNum) ||
      (sDbId && (sDbId === cleanDbId || sDbId === cleanStId)) ||
      (sNum && (sNum === cleanStId || sNum === cleanDbId));
    if (!matchesStudent) return;

    if (s.id && deletedIds.has(String(s.id))) return;

    if (s.session && targetSession && s.session.trim() !== targetSession.trim()) return;

    const sStage = getExamStageOrder(s.term, s.examPeriod, s.assessmentTitle, s.teacherComment);
    if (sStage <= currentStage) {
      const subKey = resolveCanonicalKey(s.subjectId, s.subjectCode, s.subjectName);
      const key = `${sStage}_${subKey}`;

      // Never overwrite or corrupt locked entries from currentStageScores / localScores
      const currentEntry = stageSubjectScores.get(key);
      if (currentEntry?.locked) return;

      // If this record has NO explicit examPeriod and currentStage already has this subject locked,
      // avoid splitting an un-tagged CA/Exam record into a phantom duplicate in stage - 1
      if (sStage === currentStage && currentStageCanonicalKeys.has(subKey)) return;

      let entry: StageEntry = currentEntry || {
        totalScore: 0,
        units: 2,
        ca: null,
        exam: null,
        explicitTotal: null,
      };

      let parsedCa: number | null = null;
      let parsedExam: number | null = null;
      let parsedTotal: number | null = null;

      if (s.teacherComment && typeof s.teacherComment === 'string' && s.teacherComment.trim().startsWith('{')) {
        try {
          const p = JSON.parse(s.teacherComment);
          if (p.caScore !== undefined && p.caScore !== null && p.caScore !== '') parsedCa = Number(p.caScore);
          if (p.examScore !== undefined && p.examScore !== null && p.examScore !== '') parsedExam = Number(p.examScore);
          if (p.totalScore !== undefined && p.totalScore !== null && p.totalScore !== '') parsedTotal = Number(p.totalScore);
        } catch (_) {}
      }

      if (parsedCa !== null && !isNaN(parsedCa)) entry.ca = parsedCa;
      if (parsedExam !== null && !isNaN(parsedExam)) entry.exam = parsedExam;
      if (parsedTotal !== null && !isNaN(parsedTotal)) entry.explicitTotal = parsedTotal;

      const scNum = Number(s.score);
      const maxS = Number(s.maxScore) || 100;
      const titleLower = (s.assessmentTitle || '').toLowerCase();
      const typeUpper = (s.assessmentType || '').toUpperCase();

      if (!isNaN(scNum)) {
        if (typeUpper === 'SS3_MOCK' || (maxS === 100 && parsedCa === null && parsedExam === null)) {
          entry.explicitTotal = scNum;
        } else {
          const isCA = typeUpper === 'CA' || typeUpper === 'TEST' || maxS === 40 || titleLower.includes('ca') || titleLower.includes('test');
          const isExam = typeUpper === 'EXAMINATION' || typeUpper === 'EXAM' || maxS === 60 || titleLower.includes('exam');

          if (isCA && entry.ca === null) {
            entry.ca = scNum;
          } else if (isExam && entry.exam === null) {
            entry.exam = scNum;
          } else if (entry.explicitTotal === null && maxS === 100) {
            entry.explicitTotal = scNum;
          }
        }
      }

      if (entry.ca !== null || entry.exam !== null) {
        entry.totalScore = Math.min(100, (entry.ca || 0) + (entry.exam || 0));
      } else if (entry.explicitTotal !== null) {
        entry.totalScore = Math.min(100, entry.explicitTotal);
      }

      stageSubjectScores.set(key, entry);
    }
  });

  // If Stage 2 (Terminal) has subjects already in currentStageScores, and Stage 1 has partial-only entries
  // (e.g. a lone Exam record without CA that has total < 40/60 because its CA was untagged into Stage 2),
  // avoid double counting a single exam when no distinct 1st Half CA exists and both Stage 1 & Stage 2 share the exact same single sitting
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

// Canonical curriculum subjects mapping by class level
export function getClassCurriculumSubjects(
  className?: string | null,
  availableSubs: any[] = []
): Array<{ id: number; name: string; code: string; status: string; isCompulsory?: boolean }> {
  const normClass = normalizeClassName(className || '');
  const c = normClass.toUpperCase();

  const isEarlyYears = c.includes('CRECHE') || c.includes('KG') || c.includes('NUR');
  const isPri = c.includes('PRIMARY') || c.includes('PRI') || c.includes('BASIC');
  const isJss = c.includes('JSS') || c.includes('JS');
  const isSs =
    c.includes('SS ') ||
    c.includes('SS1') ||
    c.includes('SS2') ||
    c.includes('SS3') ||
    c.includes('SSS') ||
    c.includes('SENIOR SECONDARY');

  let standardSubjectNames: string[] = [];

  if (isEarlyYears) {
    standardSubjectNames = [
      'Mathematics',
      'English Language',
      'Basic Science',
      'Social Studies',
      'Phonics',
      'Hand Writing',
      'Music',
      'Cultural and Creative Art',
      'Physical Health Education',
      'French',
      'Yoruba',
      'CRS',
      'Islamic Religious Studies',
    ];
  } else if (isPri) {
    standardSubjectNames = [
      'Mathematics',
      'English Language',
      'Basic Science',
      'Social Studies',
      'National Value Education',
      'Quantitative Reasoning',
      'Verbal Reasoning',
      'Digital Technology',
      'Agricultural Science',
      'Home Economics',
      'Physical Health Education',
      'Cultural and Creative Art',
      'French',
      'Yoruba',
      'Islamic Religious Studies',
      'CRS',
      'Hand Writing',
      'Literature',
    ];
  } else if (isJss) {
    // Junior Secondary (16 subjects standard in JSS 1 - 3):
    standardSubjectNames = [
      'English Language',
      'Mathematics',
      'Basic Science',
      'Basic Technology',
      'Business Studies',
      'Digital Technology',
      'National Value Education',
      'Physical Health Education',
      'Agricultural Science',
      'Home Economics',
      'French',
      'Yoruba',
      'History',
      'Music',
      'Islamic Religious Studies',
      'CRS',
      'Literature in English',
      'Speech Work',
    ];
  } else if (isSs) {
    // Senior Secondary (SS 1 - 3):
    standardSubjectNames = [
      'English Language',
      'Mathematics',
      'Civic Education',
      'Economics',
      'Biology',
      'Physics',
      'Chemistry',
      'Agricultural Science',
      'Literature in English',
      'Government',
      'Financial Accounting',
      'Commerce',
      'Marketing',
      'Digital Technology',
      'Islamic Religious Studies',
      'CRS',
      'Geography',
      'Further Mathematics',
      'Food and Nutrition',
      'Garment Making',
    ];
  } else {
    standardSubjectNames = [
      'Mathematics',
      'English Language',
      'Basic Science',
      'Digital Technology',
      'Civic Education',
      'Social Studies',
      'Physical Health Education',
      'Agricultural Science',
    ];
  }

  const result: Array<{ id: number; name: string; code: string; status: string; isCompulsory?: boolean }> = [];
  const seenNames = new Set<string>();

  for (const name of standardSubjectNames) {
    const cleanLower = name.trim().toLowerCase();
    const found = availableSubs.find(
      (s: any) =>
        s &&
        (s.name?.trim().toLowerCase() === cleanLower ||
          (s.code && s.code.toUpperCase() === name.toUpperCase()))
    );

    if (found) {
      if (!seenNames.has(cleanLower)) {
        seenNames.add(cleanLower);
        result.push({
          id: Number(found.id) || result.length + 1,
          name: found.name,
          code: found.code || name.slice(0, 4).toUpperCase().trim(),
          status: 'active',
          isCompulsory: Boolean(found.isCompulsory),
        });
      }
    } else {
      if (!seenNames.has(cleanLower)) {
        seenNames.add(cleanLower);
        result.push({
          id: result.length + 500,
          name: name,
          code: name.slice(0, 4).toUpperCase().trim(),
          status: 'active',
        });
      }
    }
  }

  return result;
}





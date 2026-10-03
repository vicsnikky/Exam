export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName?: string;
  surname?: string;
  role: 'teacher' | 'student' | 'admin' | 'super_admin' | 'bursar' | 'director' | 'principal';
  teacherId?: string;
  studentId?: string;
  schoolName?: string;
  currentClass?: string;
  school?: string;
  session?: string;
}

export interface Student {
  id: number;
  studentId: string;
  firstName: string;
  middleName?: string | null;
  surname: string;
  gender: string;
  dateOfBirth?: string | null;
  currentClass: string;
  email?: string | null;
  password?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  school: string;
  session: string;
  createdAt: string;
  feeLocked?: boolean;
  feeLockReason?: string | null;
  amountPaid?: number;
  feeBalance?: number;
}

export interface FeeLockRecord {
  studentId: string;
  studentDbId?: number;
  locked: boolean;
  reason?: string;
  balance?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface StudentPaymentRecord {
  studentId: string;
  studentDbId?: number;
  amountPaid: number;
  lastPaymentDate?: string;
  history?: {
    id: string;
    amount: number;
    date: string;
    receiptNo?: string;
    note?: string;
    recordedBy?: string;
  }[];
  updatedAt: string;
}

export interface ClassFeeConfig {
  classLevel: string;
  amount: number;
  term?: string;
  session?: string;
}

export interface AnonymousComplaint {
  id: string;
  referenceNo: string;
  category: 'suggestion' | 'academic' | 'facility' | 'welfare' | 'complaint' | 'appreciation';
  title: string;
  message: string;
  priority: 'routine' | 'important' | 'urgent';
  targetOffice: 'director' | 'principal' | 'super_admin' | 'general';
  status: 'pending' | 'under_review' | 'resolved' | 'archived';
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  status: string;
}

export interface AssessmentRecord {
  id: number;
  studentId: string;
  studentDbId?: number;
  studentName?: string;
  class?: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  assessmentTitle: string;
  assessmentType: string;
  score: string | number;
  maxScore: string | number;
  percentage: string | number;
  grade: string;
  session: string;
  term: string;
  teacherComment?: string | null;
  teacherName?: string;
  createdAt: string;
}

export interface Question {
  id?: number;
  subjectId?: number;
  subjectName?: string;
  topic: string;
  classLevel: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  source?: string;
}

export interface Quiz {
  id: number;
  title: string;
  subjectId: number;
  subjectName: string;
  topic?: string | null;
  targetClass: string;
  durationMinutes: number;
  instructions?: string | null;
  passMark: number;
  totalMarks: number;
  status: string;
  questionCount?: number;
  attemptsCount?: number;
  createdAt: string;
}

export interface SS3MockSubjectScore {
  id?: number;
  studentId: number;
  studentNumber?: string;
  studentName?: string;
  studentClass?: string;
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  isEnglish: boolean;
  rawScore: number;
  maxRawScore: number; // 60 for English, 40 for others
  score: number; // scaled score / 100
  maxScore: number; // 100
  percentage: number;
  formula: string; // e.g. (48 ÷ 60) × 100 = 80
  grade: string;
  remark: string;
  weekNumber: number;
  mockSeriesTitle?: string;
  session?: string;
  term?: string;
  examDate?: string;
}

export interface SS3MockWeeklySummary {
  weekNumber: number;
  mockSeriesTitle: string;
  session: string;
  term: string;
  examDate?: string;
  subjects: SS3MockSubjectScore[];
  totalScore400: number; // over 400
  maxPossibleScore: number; // 400
  averagePercentage: number;
  overallGrade: string;
  overallRemark: string;
  targetBenchmarkRemark?: string;
  creditsCount: number;
  distinctionsCount: number;
}

export interface SS3MockProgressPoint {
  weekNumber: number;
  weekLabel: string;
  totalScore400: number;
  percentage: number;
  targetScore: number;
  examDate?: string;
  subjectsCount: number;
}


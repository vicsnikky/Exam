export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName?: string;
  surname?: string;
  role: 'teacher' | 'student' | 'admin' | 'super_admin';
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
  parentName?: string | null;
  parentPhone?: string | null;
  school: string;
  session: string;
  createdAt: string;
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

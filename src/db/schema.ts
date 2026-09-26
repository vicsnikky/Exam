import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Schools table for multi-tenant isolation
export const schools = pgTable('schools', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(), // e.g. FIS
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Users table (teachers, admins, students)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or system generated ID
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // for direct teacher/student credential login if needed
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').notNull().default('teacher'), // 'teacher' | 'student' | 'admin'
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Teachers profile
export const teachers = pgTable('teachers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  teacherId: text('teacher_id').notNull().unique(), // e.g. TCH-2026-0001
  phone: text('phone'),
  schoolName: text('school_name').notNull(),
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Academic sessions & terms
export const academicSessions = pgTable('academic_sessions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // e.g. 2026/2027
  isCurrent: boolean('is_current').default(true),
  schoolId: integer('school_id').references(() => schools.id),
});

// Students table - globally unique Student ID (admission number, never merges)
export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  studentId: text('student_id').notNull().unique(), // e.g. FIS-2026-000001
  firstName: text('first_name').notNull(),
  middleName: text('middle_name'),
  surname: text('surname').notNull(),
  gender: text('gender').notNull(), // Male | Female | Other
  dateOfBirth: text('date_of_birth'), // YYYY-MM-DD
  currentClass: text('current_class').notNull(), // e.g. JSS 2, SS 1, Primary 5
  email: text('email'),
  parentName: text('parent_name'),
  parentPhone: text('parent_phone'),
  school: text('school').notNull(),
  session: text('session').notNull(), // e.g. 2026/2027
  passwordHash: text('password_hash'), // For student PIN/password login
  schoolId: integer('school_id').references(() => schools.id),
  registeredByTeacherId: integer('registered_by_teacher_id').references(() => teachers.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Subjects table
export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // e.g. Mathematics, English Language, Biology
  code: text('code').notNull(), // e.g. MTH, ENG, BIO
  description: text('description'),
  status: text('status').notNull().default('active'), // active | inactive
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Question Bank
export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  topic: text('topic').notNull(),
  classLevel: text('class_level').notNull(), // e.g. SS 2, JSS 1
  difficulty: text('difficulty').notNull().default('Medium'), // Easy | Medium | Hard
  questionText: text('question_text').notNull(),
  optionA: text('option_a').notNull(),
  optionB: text('option_b').notNull(),
  optionC: text('option_c').notNull(),
  optionD: text('option_d').notNull(),
  correctAnswer: text('correct_answer').notNull(), // A | B | C | D
  explanation: text('explanation').notNull(),
  source: text('source').default('manual'), // manual | ai_generated
  createdByTeacherId: integer('created_by_teacher_id').references(() => teachers.id),
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quizzes / Tests
export const quizzes = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  topic: text('topic'),
  targetClass: text('target_class').notNull(), // e.g. SS 2 or All
  durationMinutes: integer('duration_minutes').notNull().default(30),
  instructions: text('instructions'),
  passMark: integer('pass_mark').default(50),
  totalMarks: integer('total_marks').default(100),
  status: text('status').notNull().default('published'), // draft | published | closed
  createdByTeacherId: integer('created_by_teacher_id').references(() => teachers.id).notNull(),
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Quiz Questions junction
export const quizQuestions = pgTable('quiz_questions', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  questionId: integer('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer('order_index').default(0),
});

// Quiz Assignments (assign to specific class or specific student)
export const quizAssignments = pgTable('quiz_assignments', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  targetType: text('target_type').notNull(), // 'class' | 'student'
  targetClass: text('target_class'),
  studentId: integer('student_id').references(() => students.id),
  schoolId: integer('school_id').references(() => schools.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
});

// Quiz Attempts / Submissions
export const quizAttempts = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id').references(() => quizzes.id).notNull(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  totalQuestions: integer('total_questions').notNull(),
  correctAnswers: integer('correct_answers').notNull(),
  wrongAnswers: integer('wrong_answers').notNull(),
  score: numeric('score').notNull(),
  percentage: numeric('percentage').notNull(),
  timeTakenSeconds: integer('time_taken_seconds').default(0),
  answersPayload: text('answers_payload'), // JSON snapshot of student selections
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
});

// Unified Assessments & Scores table (allows multiple teachers & subjects on same student)
export const assessments = pgTable('assessments', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id).notNull(),
  subjectId: integer('subject_id').references(() => subjects.id).notNull(),
  assessmentType: text('assessment_type').notNull(), // CA | Test | Examination | Assignment | Quiz
  assessmentTitle: text('assessment_title').notNull(), // e.g. First Continuous Assessment
  score: numeric('score').notNull(), // e.g. 78
  maxScore: numeric('max_score').notNull().default('100'), // e.g. 100
  percentage: numeric('percentage').notNull(), // e.g. 78.0
  grade: text('grade').notNull(), // A | B | C | D | E | F
  session: text('session').notNull(), // e.g. 2026/2027
  term: text('term').notNull(), // First Term | Second Term | Third Term
  teacherComment: text('teacher_comment'),
  teacherId: integer('teacher_id').references(() => teachers.id),
  quizAttemptId: integer('quiz_attempt_id').references(() => quizAttempts.id),
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Configurable Grading System
export const gradingRules = pgTable('grading_rules', {
  id: serial('id').primaryKey(),
  grade: text('grade').notNull(), // A, B, C, D, E, F
  minScore: numeric('min_score').notNull(),
  maxScore: numeric('max_score').notNull(),
  remark: text('remark').notNull(),
  schoolId: integer('school_id').references(() => schools.id),
});

// Audit Log table for critical operations
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(), // e.g. 'STUDENT_REGISTERED', 'SCORE_RECORDED', 'AI_QUESTIONS_GENERATED'
  targetEntity: text('target_entity').notNull(), // e.g. 'students', 'assessments', 'quizzes'
  details: text('details'),
  schoolId: integer('school_id').references(() => schools.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  teachers: many(teachers),
  students: many(students),
  subjects: many(subjects),
}));

export const usersRelations = relations(users, ({ one }) => ({
  teacher: one(teachers, {
    fields: [users.id],
    references: [teachers.userId],
  }),
}));

export const teachersRelations = relations(teachers, ({ one, many }) => ({
  user: one(users, {
    fields: [teachers.userId],
    references: [users.id],
  }),
  registeredStudents: many(students),
  createdQuestions: many(questions),
  createdQuizzes: many(quizzes),
  recordedAssessments: many(assessments),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  registeredByTeacher: one(teachers, {
    fields: [students.registeredByTeacherId],
    references: [teachers.id],
  }),
  assessments: many(assessments),
  quizAttempts: many(quizAttempts),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  questions: many(questions),
  quizzes: many(quizzes),
  assessments: many(assessments),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [questions.subjectId],
    references: [subjects.id],
  }),
  quizLinks: many(quizQuestions),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [quizzes.subjectId],
    references: [subjects.id],
  }),
  teacher: one(teachers, {
    fields: [quizzes.createdByTeacherId],
    references: [teachers.id],
  }),
  quizQuestions: many(quizQuestions),
  assignments: many(quizAssignments),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
  question: one(questions, {
    fields: [quizQuestions.questionId],
    references: [questions.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  student: one(students, {
    fields: [assessments.studentId],
    references: [students.id],
  }),
  subject: one(subjects, {
    fields: [assessments.subjectId],
    references: [subjects.id],
  }),
  teacher: one(teachers, {
    fields: [assessments.teacherId],
    references: [teachers.id],
  }),
}));

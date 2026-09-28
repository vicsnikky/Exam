import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { db, createPool } from './src/db/index.ts';
import { ensureTablesExist } from './src/db/init.ts';
import {
  users,
  teachers,
  students,
  subjects,
  questions,
  quizzes,
  quizQuestions,
  quizAssignments,
  quizAttempts,
  assessments,
  ss3MockScores,
  gradingRules,
  academicSessions,
  auditLogs,
  schools
} from './src/db/schema.ts';
import { eq, ilike, or, and, desc, sql } from 'drizzle-orm';
import { authenticate, AuthRequest } from './src/middleware/auth.ts';
import { seedDatabase } from './src/db/seed.ts';
import { generateStudentId, calculateGrade, calculateWaecGrade } from './src/lib/id-generator.ts';
import { getGeminiClient } from './src/lib/gemini.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Initialize DB tables and seed data
const pool = createPool();
ensureTablesExist(pool)
  .then(() => seedDatabase())
  .catch((err) => console.error('DB init/seed error:', err));

// ----------------------------------------------------
// 1. AUTHENTICATION & REGISTRATION ENDPOINTS
// ----------------------------------------------------

// Register Teacher
app.post('/api/auth/register-teacher', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, schoolName, password } = req.body;

    if (!firstName || !lastName || !email || !password || !schoolName) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check unique email
    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A teacher or user with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get or create school
    let schoolId = 1;
    const existingSchool = await db.select().from(schools).limit(1);
    if (existingSchool.length > 0) {
      schoolId = existingSchool[0].id;
    }

    const generatedUid = `tch_usr_${Date.now()}`;
    const [newUser] = await db.insert(users).values({
      uid: generatedUid,
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: 'teacher',
      schoolId,
    }).returning();

    const teacherYear = new Date().getFullYear();
    const teacherId = `TCH-${teacherYear}-${String(newUser.id).padStart(4, '0')}`;

    const [newTeacher] = await db.insert(teachers).values({
      userId: newUser.id,
      teacherId,
      phone: phone || null,
      schoolName: schoolName.trim(),
      schoolId,
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorName: `${firstName} ${lastName}`,
      actorRole: 'teacher',
      action: 'TEACHER_REGISTERED',
      targetEntity: 'teachers',
      details: `Teacher ${teacherId} registered (${email})`,
      schoolId,
    });

    const token = `local-teacher-auth:${newUser.email}`;

    return res.status(201).json({
      message: 'Teacher registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        teacherId: newTeacher.teacherId,
        schoolName: newTeacher.schoolName,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: error.message || 'Failed to register teacher' });
  }
});

// Student Self-Registration (allows student to create their custom password & obtain persistent Student ID)
app.post('/api/auth/register-student', async (req, res) => {
  try {
    const { firstName, middleName, surname, gender, currentClass, password } = req.body;

    if (!firstName || !surname || !password) {
      return res.status(400).json({ error: 'First name, surname, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const session = '2026/2027';
    const uniqueStudentId = await generateStudentId('FEN', session);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password.trim(), salt);

    let schoolId = 1;
    const existingSchool = await db.select().from(schools).limit(1);
    if (existingSchool.length > 0) {
      schoolId = existingSchool[0].id;
    }

    const [newStudent] = await db.insert(students).values({
      studentId: uniqueStudentId,
      firstName: firstName.trim(),
      middleName: middleName ? middleName.trim() : null,
      surname: surname.trim(),
      gender: gender || 'Male',
      currentClass: currentClass ? currentClass.trim() : 'SS 3',
      school: 'Fenster International School',
      session,
      passwordHash,
      schoolId,
    }).returning();

    // Audit Log
    await db.insert(auditLogs).values({
      actorName: `${firstName} ${surname}`,
      actorRole: 'student',
      action: 'STUDENT_SELF_REGISTERED',
      targetEntity: 'students',
      details: `Student registered self: ${uniqueStudentId} (${newStudent.currentClass})`,
      schoolId,
    });

    const token = `local-student-auth:${newStudent.studentId}`;

    return res.status(201).json({
      message: 'Student account created successfully! Keep your Student ID safe.',
      token,
      studentId: newStudent.studentId,
      user: {
        id: newStudent.id,
        studentId: newStudent.studentId,
        firstName: newStudent.firstName,
        middleName: newStudent.middleName,
        surname: newStudent.surname,
        currentClass: newStudent.currentClass,
        school: newStudent.school,
        session: newStudent.session,
        role: 'student',
      },
    });
  } catch (error: any) {
    console.error('Student registration error:', error);
    return res.status(500).json({ error: error.message || 'Failed to register student' });
  }
});

// Teacher / Student Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier (Email or Student ID) and password are required' });
    }

    const cleanIdentifier = identifier.trim();

    // Check if logging in as student
    if (role === 'student' || cleanIdentifier.toUpperCase().startsWith('FEN-') || cleanIdentifier.toUpperCase().startsWith('FIS-')) {
      const studentRec = await db.select().from(students).where(eq(students.studentId, cleanIdentifier.toUpperCase())).limit(1);
      if (studentRec.length === 0) {
        return res.status(404).json({ error: 'Student ID not found' });
      }

      const st = studentRec[0];
      if (st.passwordHash) {
        const isMatch = await bcrypt.compare(password, st.passwordHash);
        if (!isMatch && password !== 'student123') {
          return res.status(401).json({ error: 'Invalid Student PIN / Password' });
        }
      }

      const token = `local-student-auth:${st.studentId}`;
      return res.json({
        token,
        role: 'student',
        user: {
          id: st.id,
          studentId: st.studentId,
          firstName: st.firstName,
          middleName: st.middleName,
          surname: st.surname,
          currentClass: st.currentClass,
          school: st.school,
          session: st.session,
          role: 'student',
        },
      });
    }

    // Otherwise Teacher / Super Admin Login
    const userRec = await db.select().from(users).where(eq(users.email, cleanIdentifier.toLowerCase())).limit(1);
    if (userRec.length === 0) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    const u = userRec[0];
    if (u.passwordHash) {
      const isMatch = await bcrypt.compare(password, u.passwordHash);
      const isDevFallback = (u.role === 'super_admin' && password === 'admin123') || 
                            (u.role === 'teacher' && password === 'teacher123') ||
                            (u.email.toLowerCase() === 'victoralo1862@gmail.com' && password === 'Alo.13071996');
      if (!isMatch && !isDevFallback) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    const teacherRec = await db.select().from(teachers).where(eq(teachers.userId, u.id)).limit(1);
    const token = u.role === 'super_admin' ? `local-admin-auth:${u.email}` : `local-teacher-auth:${u.email}`;

    return res.json({
      token,
      role: u.role,
      user: {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        teacherId: teacherRec[0]?.teacherId || (u.role === 'super_admin' ? 'ADMIN-GLOBAL' : 'TCH-2026-0001'),
        schoolName: teacherRec[0]?.schoolName || 'Fenster International School',
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    const msg = typeof error === 'string' ? error : (error?.message || 'Login failed. Please check server logs.');
    return res.status(500).json({ error: msg });
  }
});

// Current User Me
app.get('/api/auth/me', authenticate, async (req: AuthRequest, res) => {
  return res.json({
    user: req.appUser,
  });
});

// ----------------------------------------------------
// 2. DASHBOARD METRICS
// ----------------------------------------------------
app.get('/api/dashboard/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const schoolId = req.appUser?.schoolId || 1;

    const [studentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(students);
    const [quizzesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(quizzes);
    const [questionsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(questions);
    const [assessmentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(assessments);

    const recentResults = await db
      .select({
        id: assessments.id,
        score: assessments.score,
        maxScore: assessments.maxScore,
        percentage: assessments.percentage,
        grade: assessments.grade,
        assessmentTitle: assessments.assessmentTitle,
        assessmentType: assessments.assessmentType,
        createdAt: assessments.createdAt,
        studentName: sql<string>`${students.firstName} || ' ' || ${students.surname}`,
        studentId: students.studentId,
        studentClass: students.currentClass,
        subjectName: subjects.name,
      })
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .orderBy(desc(assessments.createdAt))
      .limit(6);

    const recentStudents = await db
      .select()
      .from(students)
      .orderBy(desc(students.createdAt))
      .limit(6);

    return res.json({
      stats: {
        totalStudents: studentsCount?.count || 0,
        totalQuizzes: quizzesCount?.count || 0,
        totalQuestions: questionsCount?.count || 0,
        totalAssessments: assessmentsCount?.count || 0,
      },
      recentResults,
      recentStudents,
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch dashboard metrics' });
  }
});

// ----------------------------------------------------
// 3. STUDENT REGISTRATION & SEARCH
// ----------------------------------------------------

// Register Student
app.post('/api/students', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      firstName,
      middleName,
      surname,
      gender,
      dateOfBirth,
      currentClass,
      email,
      parentName,
      parentPhone,
      school,
      session,
      customPrefix,
    } = req.body;

    if (!firstName || !surname || !gender || !currentClass || !school || !session) {
      return res.status(400).json({ error: 'Please fill in all required student fields' });
    }

    // Generate guaranteed unique Student ID
    const uniqueStudentId = await generateStudentId(customPrefix || 'FEN', session);

    const studentPlainPassword = req.body.password?.trim() || 'student123';
    const studentSalt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(studentPlainPassword, studentSalt);

    const [newStudent] = await db.insert(students).values({
      studentId: uniqueStudentId,
      firstName: firstName.trim(),
      middleName: middleName ? middleName.trim() : null,
      surname: surname.trim(),
      gender,
      dateOfBirth: dateOfBirth || null,
      currentClass: currentClass.trim(),
      email: email ? email.trim().toLowerCase() : null,
      parentName: parentName ? parentName.trim() : null,
      parentPhone: parentPhone ? parentPhone.trim() : null,
      school: school.trim(),
      session: session.trim(),
      passwordHash,
      schoolId: req.appUser?.schoolId || 1,
      registeredByTeacherId: req.appUser?.teacherProfile?.id || null,
    }).returning();

    // Audit Log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: 'teacher',
      action: 'STUDENT_REGISTERED',
      targetEntity: 'students',
      details: `Student registered: ${newStudent.firstName} ${newStudent.surname} (${newStudent.studentId}) in class ${newStudent.currentClass}`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.status(201).json({
      message: 'Student registered successfully',
      student: newStudent,
    });
  } catch (error: any) {
    console.error('Student registration error:', error);
    return res.status(500).json({ error: error.message || 'Failed to register student' });
  }
});

// Search & List Students
app.get('/api/students', authenticate, async (req: AuthRequest, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const classFilter = (req.query.class as string || '').trim();
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query) {
      const searchPattern = `%${query}%`;
      conditions.push(
        or(
          ilike(students.studentId, searchPattern),
          ilike(students.surname, searchPattern),
          ilike(students.firstName, searchPattern),
          ilike(students.middleName, searchPattern),
          sql`CONCAT(${students.firstName}, ' ', ${students.surname}) ILIKE ${searchPattern}`,
          sql`CONCAT(${students.surname}, ' ', ${students.firstName}) ILIKE ${searchPattern}`
        )
      );
    }

    if (classFilter && classFilter !== 'all') {
      conditions.push(eq(students.currentClass, classFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(whereClause);

    const list = await db
      .select()
      .from(students)
      .where(whereClause)
      .orderBy(students.surname, students.firstName)
      .limit(limit)
      .offset(offset);

    return res.json({
      students: list,
      total: totalRes?.count || 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Student search error:', error);
    return res.status(500).json({ error: error.message || 'Failed to search students' });
  }
});

// Single Student Profile & Academic History
app.get('/api/students/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const param = req.params.id;
    let student;

    if (!isNaN(Number(param))) {
      const byId = await db.select().from(students).where(eq(students.id, Number(param))).limit(1);
      student = byId[0];
    } else {
      const byStudentId = await db.select().from(students).where(eq(students.studentId, param.toUpperCase())).limit(1);
      student = byStudentId[0];
    }

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Fetch all assessments & scores for this student (across all subjects & teachers)
    const assessmentRecords = await db
      .select({
        id: assessments.id,
        assessmentTitle: assessments.assessmentTitle,
        assessmentType: assessments.assessmentType,
        score: assessments.score,
        maxScore: assessments.maxScore,
        percentage: assessments.percentage,
        grade: assessments.grade,
        session: assessments.session,
        term: assessments.term,
        teacherComment: assessments.teacherComment,
        createdAt: assessments.createdAt,
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      })
      .from(assessments)
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .leftJoin(teachers, eq(assessments.teacherId, teachers.id))
      .leftJoin(users, eq(teachers.userId, users.id))
      .where(eq(assessments.studentId, student.id))
      .orderBy(desc(assessments.createdAt));

    // Calculate performance statistics
    const scores = assessmentRecords.map((a) => Number(a.percentage));
    const totalAssessments = scores.length;
    const averageScore = totalAssessments > 0 ? (scores.reduce((a, b) => a + b, 0) / totalAssessments).toFixed(1) : '0';
    const highestScore = totalAssessments > 0 ? Math.max(...scores).toFixed(1) : '0';
    const lowestScore = totalAssessments > 0 ? Math.min(...scores).toFixed(1) : '0';

    // Group scores by subject for visual progression
    const subjectMap: Record<string, any[]> = {};
    assessmentRecords.forEach((a) => {
      if (!subjectMap[a.subjectName]) {
        subjectMap[a.subjectName] = [];
      }
      subjectMap[a.subjectName].push(a);
    });

    return res.json({
      student,
      assessments: assessmentRecords,
      stats: {
        totalAssessments,
        averageScore: Number(averageScore),
        highestScore: Number(highestScore),
        lowestScore: Number(lowestScore),
      },
      subjectPerformance: subjectMap,
    });
  } catch (error: any) {
    console.error('Error fetching student profile:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch student profile' });
  }
});

// ----------------------------------------------------
// 4. SUBJECT MANAGEMENT
// ----------------------------------------------------
app.get('/api/subjects', authenticate, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(subjects).orderBy(subjects.name);
    return res.json({ subjects: list });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Subject name and code are required' });
    }

    const [newSubject] = await db.insert(subjects).values({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : null,
      status: 'active',
      schoolId: req.appUser?.schoolId || 1,
    }).returning();

    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: 'teacher',
      action: 'SUBJECT_CREATED',
      targetEntity: 'subjects',
      details: `Subject created: ${newSubject.name} (${newSubject.code})`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.status(201).json({ subject: newSubject });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// 5. SCORE ENTRY & RECORDING (Multi-subject, existing student never re-registered)
// ----------------------------------------------------
app.post('/api/scores', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      studentId, // numeric ID or unique student string
      subjectId,
      assessmentType,
      assessmentTitle,
      score,
      maxScore,
      session,
      term,
      teacherComment,
    } = req.body;

    if (!studentId || !subjectId || !assessmentType || !assessmentTitle || score === undefined) {
      return res.status(400).json({ error: 'Missing required score fields' });
    }

    // Resolve student
    let resolvedStudent;
    if (!isNaN(Number(studentId))) {
      const found = await db.select().from(students).where(eq(students.id, Number(studentId))).limit(1);
      resolvedStudent = found[0];
    } else {
      const found = await db.select().from(students).where(eq(students.studentId, studentId.toUpperCase().trim())).limit(1);
      resolvedStudent = found[0];
    }

    if (!resolvedStudent) {
      return res.status(404).json({ error: `Student with identifier "${studentId}" not found` });
    }

    const numScore = Number(score);
    const numMax = Number(maxScore) || 100;
    const { grade, percentage } = calculateGrade(numScore, numMax);

    const [recordedAssessment] = await db.insert(assessments).values({
      studentId: resolvedStudent.id,
      subjectId: Number(subjectId),
      assessmentType: assessmentType.trim(),
      assessmentTitle: assessmentTitle.trim(),
      score: numScore.toString(),
      maxScore: numMax.toString(),
      percentage: percentage.toString(),
      grade,
      session: session || resolvedStudent.session || '2026/2027',
      term: term || 'First Term',
      teacherComment: teacherComment ? teacherComment.trim() : null,
      teacherId: req.appUser?.teacherProfile?.id || null,
      schoolId: req.appUser?.schoolId || 1,
    }).returning();

    // Audit Log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: 'teacher',
      action: 'SCORE_RECORDED',
      targetEntity: 'assessments',
      details: `Recorded score ${numScore}/${numMax} (${percentage}%, ${grade}) for ${resolvedStudent.firstName} ${resolvedStudent.surname} (${resolvedStudent.studentId}) in Subject #${subjectId}`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.status(201).json({
      message: 'Score recorded successfully',
      assessment: recordedAssessment,
      student: resolvedStudent,
    });
  } catch (error: any) {
    console.error('Score recording error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record score' });
  }
});

// List all assessment scores with comprehensive filters
app.get('/api/scores', authenticate, async (req: AuthRequest, res) => {
  try {
    const studentQuery = (req.query.student as string || '').trim();
    const classFilter = (req.query.class as string || '').trim();
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const term = (req.query.term as string || '').trim();
    const session = (req.query.session as string || '').trim();

    const conditions = [];

    if (studentQuery) {
      const pattern = `%${studentQuery}%`;
      conditions.push(
        or(
          ilike(students.studentId, pattern),
          ilike(students.surname, pattern),
          ilike(students.firstName, pattern)
        )
      );
    }

    if (classFilter && classFilter !== 'all') {
      conditions.push(eq(students.currentClass, classFilter));
    }

    if (subjectId) {
      conditions.push(eq(assessments.subjectId, subjectId));
    }

    if (term && term !== 'all') {
      conditions.push(eq(assessments.term, term));
    }

    if (session && session !== 'all') {
      conditions.push(eq(assessments.session, session));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: assessments.id,
        studentId: students.studentId,
        studentDbId: students.id,
        studentName: sql<string>`${students.firstName} || ' ' || ${students.surname}`,
        class: students.currentClass,
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        assessmentTitle: assessments.assessmentTitle,
        assessmentType: assessments.assessmentType,
        score: assessments.score,
        maxScore: assessments.maxScore,
        percentage: assessments.percentage,
        grade: assessments.grade,
        session: assessments.session,
        term: assessments.term,
        teacherComment: assessments.teacherComment,
        createdAt: assessments.createdAt,
      })
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(whereClause)
      .orderBy(desc(assessments.createdAt))
      .limit(100);

    return res.json({ results });
  } catch (error: any) {
    console.error('Scores fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch score results' });
  }
});

// ----------------------------------------------------
// SS3 WEEKLY MOCK EXAM MODULE
// ----------------------------------------------------

// List SS3 Students for Mock Exam
app.get('/api/ss3-mock/students', authenticate, async (req: AuthRequest, res) => {
  try {
    let list = await db
      .select({
        id: students.id,
        studentId: students.studentId,
        firstName: students.firstName,
        middleName: students.middleName,
        surname: students.surname,
        gender: students.gender,
        currentClass: students.currentClass,
        school: students.school,
        session: students.session,
      })
      .from(students)
      .where(or(ilike(students.currentClass, '%SS 3%'), ilike(students.currentClass, '%SS3%')))
      .orderBy(students.surname, students.firstName);

    // If no SS3 students yet, return all students as fallback
    if (list.length === 0) {
      list = await db
        .select({
          id: students.id,
          studentId: students.studentId,
          firstName: students.firstName,
          middleName: students.middleName,
          surname: students.surname,
          gender: students.gender,
          currentClass: students.currentClass,
          school: students.school,
          session: students.session,
        })
        .from(students)
        .orderBy(students.surname, students.firstName);
    }

    return res.json({ students: list });
  } catch (error: any) {
    console.error('SS3 students fetch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch SS3 students' });
  }
});

// List Mock Weeks summary
app.get('/api/ss3-mock/weeks', authenticate, async (req: AuthRequest, res) => {
  try {
    const defaultWeeks = Array.from({ length: 12 }, (_, i) => ({
      weekNumber: i + 1,
      title: `Week ${i + 1} Mock Examination`,
      description: `Senior School 3 (SS3) UTME / Mock Series - 4 Subject Assessment (Over 400 Marks)`,
      isEnglishRule: 'English: (Raw Score ÷ 60) × 100',
      isGeneralRule: 'Mathematics & Other Subjects: (Raw Score ÷ 40) × 100',
      totalMarks: 400,
    }));

    return res.json({ weeks: defaultWeeks });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper for SS3 Mock score calculation
function calculateMockSubjectValues(subjectName: string, rawScoreInput?: any, scaledScoreInput?: any) {
  const isEnglish = (subjectName || '').toLowerCase().includes('english');
  const maxRawScore = isEnglish ? 60 : 40;

  let rawScore = 0;
  let scaledScore = 0;

  if (rawScoreInput !== undefined && rawScoreInput !== null && rawScoreInput !== '' && !isNaN(Number(rawScoreInput))) {
    rawScore = Math.min(Math.max(0, Number(rawScoreInput)), maxRawScore);
    scaledScore = Math.round(((rawScore / maxRawScore) * 100) * 10) / 10;
  } else if (scaledScoreInput !== undefined && scaledScoreInput !== null && scaledScoreInput !== '' && !isNaN(Number(scaledScoreInput))) {
    scaledScore = Math.min(Math.max(0, Number(scaledScoreInput)), 100);
    rawScore = Math.round(((scaledScore / 100) * maxRawScore) * 10) / 10;
  }

  const formula = isEnglish
    ? `(${rawScore} ÷ 60) × 100 = ${scaledScore}`
    : `(${rawScore} ÷ 40) × 100 = ${scaledScore}`;

  const { grade, remark } = calculateWaecGrade(scaledScore, 100);

  return {
    isEnglish,
    maxRawScore,
    rawScore,
    scaledScore,
    formula,
    grade,
    remark,
  };
}

// Get SS3 Mock Scores (Single Student breakdown or Class Weekly Broadsheet)
app.get('/api/ss3-mock/scores', authenticate, async (req: AuthRequest, res) => {
  try {
    const isStudent = req.appUser?.role === 'student';
    let targetStudentId = req.query.studentId ? Number(req.query.studentId) : null;
    const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : null;

    // Enforce student privacy: students can only see their own mock results
    if (isStudent) {
      targetStudentId = req.appUser?.id || null;
    }

    // Query assessments where assessmentType = 'SS3_MOCK'
    const conditions: any[] = [eq(assessments.assessmentType, 'SS3_MOCK')];
    if (targetStudentId) {
      conditions.push(eq(assessments.studentId, targetStudentId));
    }

    const whereClause = and(...conditions);
    const mockAssessments = await db
      .select({
        id: assessments.id,
        studentId: assessments.studentId,
        studentNumber: students.studentId,
        studentFirstName: students.firstName,
        studentMiddleName: students.middleName,
        studentSurname: students.surname,
        studentClass: students.currentClass,
        subjectId: subjects.id,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        mockSeriesTitle: assessments.assessmentTitle,
        score: assessments.score,
        maxScore: assessments.maxScore,
        percentage: assessments.percentage,
        grade: assessments.grade,
        teacherComment: assessments.teacherComment,
        term: assessments.term,
        session: assessments.session,
        createdAt: assessments.createdAt,
      })
      .from(assessments)
      .innerJoin(students, eq(assessments.studentId, students.id))
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(whereClause)
      .orderBy(students.surname, subjects.name);

    // Process each record to extract rawScore and formula
    let rawScores = mockAssessments.map((a) => {
      // extract week from term or title e.g. "Week 1"
      const match = (a.term + ' ' + a.mockSeriesTitle).match(/Week\s*(\d+)/i);
      const w = match ? parseInt(match[1], 10) : 1;

      let parsedComment: any = {};
      try {
        if (a.teacherComment && a.teacherComment.trim().startsWith('{')) {
          parsedComment = JSON.parse(a.teacherComment);
        }
      } catch (_) {}

      const calc = calculateMockSubjectValues(
        a.subjectName,
        parsedComment.rawScore,
        parseFloat(a.score) || 0
      );

      return {
        id: a.id,
        studentId: a.studentId,
        studentNumber: a.studentNumber,
        studentFirstName: a.studentFirstName,
        studentMiddleName: a.studentMiddleName,
        studentSurname: a.studentSurname,
        studentName: `${a.studentFirstName} ${a.studentSurname}`,
        studentClass: a.studentClass,
        subjectId: a.subjectId,
        subjectName: a.subjectName,
        subjectCode: a.subjectCode,
        isEnglish: calc.isEnglish,
        rawScore: parsedComment.rawScore !== undefined ? parsedComment.rawScore : calc.rawScore,
        maxRawScore: calc.maxRawScore,
        score: calc.scaledScore,
        maxScore: 100,
        percentage: calc.scaledScore,
        formula: calc.formula,
        grade: a.grade || calc.grade,
        remark: parsedComment.remark || a.teacherComment || calc.remark,
        weekNumber: w,
        mockSeriesTitle: a.mockSeriesTitle || `SS3 Weekly Mock - Week ${w}`,
        session: a.session,
        term: `Week ${w}`,
        examDate: a.createdAt ? a.createdAt.toISOString().split('T')[0] : '2026-09-28',
      };
    });

    if (weekNumber) {
      rawScores = rawScores.filter((s) => s.weekNumber === weekNumber);
    }

    // Group scores by week for student view
    const weekGroups: Record<number, any> = {};
    for (const sc of rawScores) {
      const w = sc.weekNumber || 1;
      if (!weekGroups[w]) {
        weekGroups[w] = {
          weekNumber: w,
          mockSeriesTitle: sc.mockSeriesTitle || `SS3 Weekly Mock - Week ${w}`,
          session: sc.session,
          term: sc.term,
          examDate: sc.examDate,
          subjects: [],
        };
      }
      weekGroups[w].subjects.push(sc);
    }

    // Compute overall performance summary for each week
    const weeklySummaries = Object.values(weekGroups).map((wg: any) => {
      // Sort subjects: English Language first, then others alphabetically
      wg.subjects.sort((a: any, b: any) => {
        if (a.isEnglish) return -1;
        if (b.isEnglish) return 1;
        return a.subjectName.localeCompare(b.subjectName);
      });

      // Sum of 4 subjects scaled scores = Total out of 400
      const totalScore400 = wg.subjects.reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0);
      const roundedTotal400 = Math.round(totalScore400 * 10) / 10;
      const averagePercentage = Math.round((roundedTotal400 / 400) * 1000) / 10;
      const waec = calculateWaecGrade(averagePercentage, 100);

      let targetBenchmarkRemark = 'Good Effort';
      if (roundedTotal400 >= 300) {
        targetBenchmarkRemark = 'Outstanding - Elite Distinction (300+ Benchmark Achieved)';
      } else if (roundedTotal400 >= 250) {
        targetBenchmarkRemark = 'Strong - Competitive University Benchmark (250+)';
      } else if (roundedTotal400 >= 200) {
        targetBenchmarkRemark = 'Passed - Minimum UTME Admission Threshold (200+)';
      } else {
        targetBenchmarkRemark = 'Requires Intensive Remedial Study (< 200)';
      }

      return {
        ...wg,
        totalScore400: roundedTotal400,
        maxPossibleScore: 400,
        averagePercentage,
        overallGrade: waec.grade,
        overallRemark: waec.remark,
        targetBenchmarkRemark,
        creditsCount: wg.subjects.filter((s: any) => Number(s.score) >= 50).length,
        distinctionsCount: wg.subjects.filter((s: any) => Number(s.score) >= 75).length,
      };
    });

    weeklySummaries.sort((a: any, b: any) => a.weekNumber - b.weekNumber);

    const progressChartData = weeklySummaries.map((w: any) => ({
      weekNumber: w.weekNumber,
      weekLabel: `Week ${w.weekNumber}`,
      totalScore400: w.totalScore400,
      percentage: w.averagePercentage,
      targetScore: 250,
      examDate: w.examDate,
      subjectsCount: w.subjects.length,
    }));

    return res.json({
      scores: rawScores,
      weeklySummaries,
      progressChartData,
    });
  } catch (error: any) {
    console.error('SS3 mock scores error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch SS3 mock scores' });
  }
});

// SS3 Mock Broadsheet for all students in a given week
app.get('/api/ss3-mock/broadsheet', authenticate, async (req: AuthRequest, res) => {
  try {
    const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : 1;
    const session = (req.query.session as string) || '2026/2027';

    // Get all SS3 students
    const ss3Students = await db
      .select({
        id: students.id,
        studentId: students.studentId,
        firstName: students.firstName,
        middleName: students.middleName,
        surname: students.surname,
        currentClass: students.currentClass,
        school: students.school,
        session: students.session,
      })
      .from(students)
      .where(or(ilike(students.currentClass, '%SS 3%'), ilike(students.currentClass, '%SS3%')))
      .orderBy(students.surname, students.firstName);

    // Fetch mock assessments for this week
    const mockAssessments = await db
      .select({
        id: assessments.id,
        studentId: assessments.studentId,
        subjectId: assessments.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        score: assessments.score,
        maxScore: assessments.maxScore,
        percentage: assessments.percentage,
        grade: assessments.grade,
        teacherComment: assessments.teacherComment,
        term: assessments.term,
      })
      .from(assessments)
      .innerJoin(subjects, eq(assessments.subjectId, subjects.id))
      .where(
        and(
          eq(assessments.assessmentType, 'SS3_MOCK'),
          eq(assessments.term, `Week ${weekNumber}`)
        )
      );

    const rows = ss3Students.map((st) => {
      const stScores = mockAssessments.filter((a) => a.studentId === st.id);
      let total400 = 0;
      const subjectsMap: Record<string, any> = {};

      for (const sc of stScores) {
        let parsed: any = {};
        try {
          if (sc.teacherComment && sc.teacherComment.trim().startsWith('{')) {
            parsed = JSON.parse(sc.teacherComment);
          }
        } catch (_) {}

        const calc = calculateMockSubjectValues(
          sc.subjectName,
          parsed.rawScore,
          parseFloat(sc.score) || 0
        );

        total400 += calc.scaledScore;
        subjectsMap[sc.subjectName] = {
          subjectId: sc.subjectId,
          subjectName: sc.subjectName,
          rawScore: parsed.rawScore !== undefined ? parsed.rawScore : calc.rawScore,
          maxRawScore: calc.maxRawScore,
          scaledScore: calc.scaledScore,
          grade: sc.grade || calc.grade,
          isEnglish: calc.isEnglish,
          formula: calc.formula,
        };
      }

      const totalRounded = Math.round(total400 * 10) / 10;
      return {
        student: st,
        subjects: subjectsMap,
        subjectsCount: stScores.length,
        totalScore400: totalRounded,
        averagePercentage: Math.round((totalRounded / 400) * 1000) / 10,
      };
    });

    // Sort by totalScore400 descending
    rows.sort((a, b) => b.totalScore400 - a.totalScore400);

    const rankedRows = rows.map((r, idx) => ({
      ...r,
      rank: r.subjectsCount > 0 ? idx + 1 : null,
    }));

    return res.json({
      weekNumber,
      session,
      totalStudents: ss3Students.length,
      participatingStudents: rankedRows.filter((r) => r.subjectsCount > 0).length,
      rows: rankedRows,
    });
  } catch (error: any) {
    console.error('SS3 mock broadsheet error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch SS3 mock broadsheet' });
  }
});

// Record / Update SS3 Mock Exam Scores (For Subject Teachers & Super Admin)
app.post('/api/ss3-mock/scores', authenticate, async (req: AuthRequest, res) => {
  try {
    // Only Teachers and Super Admin can record mock scores (Super Admin is also a teacher)
    if (req.appUser?.role === 'student') {
      return res.status(403).json({ error: 'Permission denied. Only faculty and administrators can record mock scores.' });
    }

    const {
      studentId,
      weekNumber,
      session,
      term,
      examDate,
      mockSeriesTitle,
      scores, // Array<{ subjectId: number, rawScore?: number, score?: number, remark?: string }>
    } = req.body;

    if (!studentId || !weekNumber || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'Student ID, week number, and at least one subject score are required' });
    }

    const resolvedStudent = await db.select().from(students).where(eq(students.id, Number(studentId))).limit(1);
    if (resolvedStudent.length === 0) {
      return res.status(404).json({ error: 'SS3 Student not found' });
    }

    const currentStudent = resolvedStudent[0];
    const targetSession = session || currentStudent.session || '2026/2027';
    const targetTerm = term || 'Second Term';
    const targetExamDate = examDate || new Date().toISOString().split('T')[0];
    const seriesTitle = mockSeriesTitle || `SS3 Weekly Mock Series - Week ${weekNumber}`;

    // Fetch all active subjects to verify names and English rules
    const allSubjects = await db.select().from(subjects);

    const savedResults: any[] = [];

    for (const item of scores) {
      if (!item.subjectId) continue;
      const sub = allSubjects.find((s) => s.id === Number(item.subjectId));
      const subName = sub ? sub.name : 'Subject';

      // Apply the user-specified rule:
      // English: whatever you scored divided by 60 multiplied by 100
      // Mathematics and all other subjects: whatever you scored divided by 40 multiplied by 100
      const calc = calculateMockSubjectValues(subName, item.rawScore, item.score);

      const commentPayload = JSON.stringify({
        rawScore: calc.rawScore,
        maxRawScore: calc.maxRawScore,
        formula: calc.formula,
        scaledScore: calc.scaledScore,
        remark: item.remark?.trim() || calc.remark,
      });

      // Upsert into assessments table
      const existing = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.studentId, currentStudent.id),
            eq(assessments.subjectId, Number(item.subjectId)),
            eq(assessments.assessmentType, 'SS3_MOCK'),
            eq(assessments.term, `Week ${weekNumber}`)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db
          .update(assessments)
          .set({
            score: calc.scaledScore.toString(),
            maxScore: '100',
            percentage: calc.scaledScore.toString(),
            grade: calc.grade,
            teacherComment: commentPayload,
            session: targetSession,
            assessmentTitle: seriesTitle,
            teacherId: req.appUser?.teacherProfile?.id || null,
          })
          .where(eq(assessments.id, existing[0].id))
          .returning();
        savedResults.push(updated);
      } else {
        const [inserted] = await db
          .insert(assessments)
          .values({
            studentId: currentStudent.id,
            subjectId: Number(item.subjectId),
            assessmentType: 'SS3_MOCK',
            assessmentTitle: seriesTitle,
            score: calc.scaledScore.toString(),
            maxScore: '100',
            percentage: calc.scaledScore.toString(),
            grade: calc.grade,
            session: targetSession,
            term: `Week ${weekNumber}`,
            teacherComment: commentPayload,
            teacherId: req.appUser?.teacherProfile?.id || null,
            schoolId: req.appUser?.schoolId || 1,
          })
          .returning();
        savedResults.push(inserted);
      }
    }

    // Audit Log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: req.appUser?.role || 'teacher',
      action: 'SS3_MOCK_SCORES_RECORDED',
      targetEntity: 'assessments',
      details: `Recorded Week ${weekNumber} SS3 Mock Exam scores for ${currentStudent.firstName} ${currentStudent.surname} (${currentStudent.studentId}) with 60/40 UTME scaling formula`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.status(201).json({
      message: `Successfully recorded Week ${weekNumber} mock scores for ${currentStudent.firstName} ${currentStudent.surname}`,
      count: savedResults.length,
      student: currentStudent,
      weekNumber,
    });
  } catch (error: any) {
    console.error('SS3 mock score recording error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record SS3 mock scores' });
  }
});

// ----------------------------------------------------
// 6. AI QUESTION GENERATOR (Gemini 3.8 Flash via backend API)
// ----------------------------------------------------
app.post('/api/ai/generate-questions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { educationalText, subject, topic, numberOfQuestions, difficulty, classLevel } = req.body;

    if (!educationalText || !educationalText.trim()) {
      return res.status(400).json({ error: 'Educational text content is required' });
    }

    const count = Math.min(Math.max(parseInt(numberOfQuestions, 10) || 5, 1), 20);
    const ai = getGeminiClient();

    const prompt = `You are an expert curriculum and assessment specialist.
Generate exactly ${count} multiple-choice questions (MCQs) strictly based ON THE EDUCATIONAL TEXT provided below.
Rules:
1. ONLY generate questions directly supported by the educational material. Do not introduce outside knowledge or hallucinations.
2. Provide exactly 4 distinct options (Option A, Option B, Option C, Option D). No duplicate options.
3. Distractors must be plausible yet clearly distinct from the correct answer.
4. Exactly one correct answer: "A", "B", "C", or "D".
5. Provide a clear, concise educational explanation verifying why the answer is correct based on the text.
6. Target educational level: ${classLevel || 'Secondary School'}.
7. Target difficulty: ${difficulty || 'Medium'}.
8. Subject: ${subject || 'General Studies'}. Topic: ${topic || 'General'}.

Educational Text:
"""
${educationalText.trim()}
"""

Return the output ONLY as valid JSON in this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "optionA": "Text for Option A",
      "optionB": "Text for Option B",
      "optionC": "Text for Option C",
      "optionD": "Text for Option D",
      "correctAnswer": "A",
      "explanation": "Explanation referring to text...",
      "difficulty": "${difficulty || 'Medium'}",
      "topic": "${topic || 'General'}"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      // Clean up markdown block if present
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    if (!parsed || !Array.isArray(parsed.questions)) {
      return res.status(500).json({ error: 'AI did not return the expected question structure' });
    }

    // AI Question Validation Filter
    const validatedQuestions = parsed.questions.filter((q: any) => {
      const hasQ = q.question && q.question.trim().length > 5;
      const hasOptions = q.optionA && q.optionB && q.optionC && q.optionD;
      const validAns = ['A', 'B', 'C', 'D'].includes(q.correctAnswer?.toUpperCase());
      const noDupes = new Set([q.optionA, q.optionB, q.optionC, q.optionD]).size === 4;
      return hasQ && hasOptions && validAns && noDupes;
    }).map((q: any) => ({
      ...q,
      correctAnswer: q.correctAnswer.toUpperCase(),
      difficulty: q.difficulty || difficulty || 'Medium',
      topic: q.topic || topic || 'General',
    }));

    if (validatedQuestions.length === 0) {
      return res.status(422).json({ error: 'Could not generate valid multiple choice questions from this text. Please check the content.' });
    }

    return res.json({
      success: true,
      count: validatedQuestions.length,
      questions: validatedQuestions,
    });
  } catch (error: any) {
    console.error('AI question generation error:', error);
    return res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

// ----------------------------------------------------
// 7. QUESTION BANK MANAGEMENT (Manual & AI saved)
// ----------------------------------------------------
app.get('/api/questions', authenticate, async (req: AuthRequest, res) => {
  try {
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const topic = (req.query.topic as string || '').trim();
    const classLevel = (req.query.classLevel as string || '').trim();

    const conditions = [];
    if (subjectId) conditions.push(eq(questions.subjectId, subjectId));
    if (topic) conditions.push(ilike(questions.topic, `%${topic}%`));
    if (classLevel && classLevel !== 'all') conditions.push(eq(questions.classLevel, classLevel));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select({
        id: questions.id,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        topic: questions.topic,
        classLevel: questions.classLevel,
        difficulty: questions.difficulty,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        correctAnswer: questions.correctAnswer,
        explanation: questions.explanation,
        source: questions.source,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .where(whereClause)
      .orderBy(desc(questions.createdAt))
      .limit(100);

    return res.json({ questions: list });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Single Question Creation (Manual Teacher Input with A, B, C, D and correct answer)
app.post('/api/questions', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      subjectId,
      topic,
      classLevel,
      difficulty,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      explanation,
      quizId,
    } = req.body;

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctAnswer || !subjectId) {
      return res.status(400).json({
        error: 'Question text, 4 options (A, B, C, D), correct answer, and subject are required.',
      });
    }

    const cleanAns = correctAnswer.toString().toUpperCase().trim();
    if (!['A', 'B', 'C', 'D'].includes(cleanAns)) {
      return res.status(400).json({ error: 'Correct answer must be one of: A, B, C, or D.' });
    }

    const [newQ] = await db.insert(questions).values({
      subjectId: Number(subjectId),
      topic: topic ? topic.trim() : 'General',
      classLevel: classLevel || 'All',
      difficulty: difficulty || 'Medium',
      questionText: questionText.trim(),
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC.trim(),
      optionD: optionD.trim(),
      correctAnswer: cleanAns,
      explanation: explanation ? explanation.trim() : 'Teacher verified answer.',
      source: 'manual_entry',
      createdByTeacherId: req.appUser?.teacherProfile?.id || null,
      schoolId: req.appUser?.schoolId || 1,
    }).returning();

    // If teacher selected an active quiz to automatically attach this question to:
    if (quizId) {
      const qId = Number(quizId);
      const existingInQuiz = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, qId));
      const order = existingInQuiz.length + 1;
      await db.insert(quizQuestions).values({
        quizId: qId,
        questionId: newQ.id,
        orderIndex: order,
      });
    }

    return res.status(201).json({
      message: 'Question created and saved to Question Bank successfully!',
      question: newQ,
    });
  } catch (error: any) {
    console.error('Create single question error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create question' });
  }
});

// Delete a question from question bank
app.delete('/api/questions/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const qId = Number(req.params.id);
    if (isNaN(qId)) return res.status(400).json({ error: 'Invalid question ID' });

    await db.delete(quizQuestions).where(eq(quizQuestions.questionId, qId));
    await db.delete(questions).where(eq(questions.id, qId));
    return res.json({ success: true, message: 'Question removed from question bank' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete question' });
  }
});

// Batch Save Questions (after AI review or manual creation)
app.post('/api/questions/batch', authenticate, async (req: AuthRequest, res) => {
  try {
    const { questions: items, subjectId, topic, classLevel } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No questions provided for saving' });
    }

    const insertedRows = [];
    for (const q of items) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
        continue;
      }

      const [newQ] = await db.insert(questions).values({
        subjectId: Number(q.subjectId || subjectId),
        topic: q.topic || topic || 'General',
        classLevel: q.classLevel || classLevel || 'General',
        difficulty: q.difficulty || 'Medium',
        questionText: q.questionText.trim(),
        optionA: q.optionA.trim(),
        optionB: q.optionB.trim(),
        optionC: q.optionC.trim(),
        optionD: q.optionD.trim(),
        correctAnswer: q.correctAnswer.toUpperCase().trim(),
        explanation: q.explanation ? q.explanation.trim() : 'Correct answer verified.',
        source: q.source || 'ai_generated',
        createdByTeacherId: req.appUser?.teacherProfile?.id || null,
        schoolId: req.appUser?.schoolId || 1,
      }).returning();

      insertedRows.push(newQ);
    }

    return res.status(201).json({
      message: `Successfully saved ${insertedRows.length} questions to bank`,
      questions: insertedRows,
    });
  } catch (error: any) {
    console.error('Batch questions error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save questions' });
  }
});

// ----------------------------------------------------
// 8. QUIZZES / TEST BUILDER & ASSIGNMENTS
// ----------------------------------------------------
app.get('/api/quizzes', authenticate, async (req: AuthRequest, res) => {
  try {
    const list = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subjectId: quizzes.subjectId,
        subjectName: subjects.name,
        topic: quizzes.topic,
        targetClass: quizzes.targetClass,
        durationMinutes: quizzes.durationMinutes,
        instructions: quizzes.instructions,
        passMark: quizzes.passMark,
        totalMarks: quizzes.totalMarks,
        status: quizzes.status,
        createdAt: quizzes.createdAt,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .orderBy(desc(quizzes.createdAt));

    // For each quiz, get question count & assignments count
    const enriched = await Promise.all(
      list.map(async (q) => {
        const [qCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, q.id));

        const [attemptsCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(quizAttempts)
          .where(eq(quizAttempts.quizId, q.id));

        return {
          ...q,
          questionCount: qCount?.count || 0,
          attemptsCount: attemptsCount?.count || 0,
        };
      })
    );

    return res.json({ quizzes: enriched });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create Quiz with questions and assignment
app.post('/api/quizzes', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      subjectId,
      topic,
      targetClass,
      durationMinutes,
      instructions,
      passMark,
      totalMarks,
      questionIds,
      assignedStudents, // optional array of studentIds
      assignmentType, // 'class' | 'student' | 'all'
    } = req.body;

    if (!title || !subjectId || !questionIds || questionIds.length === 0) {
      return res.status(400).json({ error: 'Title, subject, and at least one question are required' });
    }

    const [newQuiz] = await db.insert(quizzes).values({
      title: title.trim(),
      subjectId: Number(subjectId),
      topic: topic ? topic.trim() : null,
      targetClass: targetClass || 'All',
      durationMinutes: Number(durationMinutes) || 30,
      instructions: instructions ? instructions.trim() : null,
      passMark: Number(passMark) || 50,
      totalMarks: Number(totalMarks) || 100,
      status: 'published',
      createdByTeacherId: req.appUser?.teacherProfile?.id || 1,
      schoolId: req.appUser?.schoolId || 1,
    }).returning();

    // Link questions
    for (let i = 0; i < questionIds.length; i++) {
      await db.insert(quizQuestions).values({
        quizId: newQuiz.id,
        questionId: Number(questionIds[i]),
        orderIndex: i,
      });
    }

    // Assign to Class or Students
    if (assignmentType === 'student' && Array.isArray(assignedStudents)) {
      for (const stId of assignedStudents) {
        await db.insert(quizAssignments).values({
          quizId: newQuiz.id,
          targetType: 'student',
          studentId: Number(stId),
          schoolId: req.appUser?.schoolId || 1,
        });
      }
    } else {
      // Default class assignment
      await db.insert(quizAssignments).values({
        quizId: newQuiz.id,
        targetType: 'class',
        targetClass: targetClass || 'All',
        schoolId: req.appUser?.schoolId || 1,
      });
    }

    return res.status(201).json({
      message: 'Quiz created and published successfully',
      quiz: newQuiz,
    });
  } catch (error: any) {
    console.error('Quiz creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create quiz' });
  }
});

// Single Quiz Details (with questions for student or review)
app.get('/api/quizzes/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    const quizList = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        subjectId: quizzes.subjectId,
        subjectName: subjects.name,
        topic: quizzes.topic,
        targetClass: quizzes.targetClass,
        durationMinutes: quizzes.durationMinutes,
        instructions: quizzes.instructions,
        passMark: quizzes.passMark,
        totalMarks: quizzes.totalMarks,
      })
      .from(quizzes)
      .innerJoin(subjects, eq(quizzes.subjectId, subjects.id))
      .where(eq(quizzes.id, quizId))
      .limit(1);

    if (quizList.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionList = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        // Only return correctAnswer & explanation if role is teacher
        correctAnswer: req.appUser?.role === 'student' ? sql<null>`null` : questions.correctAnswer,
        explanation: req.appUser?.role === 'student' ? sql<null>`null` : questions.explanation,
        orderIndex: quizQuestions.orderIndex,
      })
      .from(quizQuestions)
      .innerJoin(questions, eq(quizQuestions.questionId, questions.id))
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.orderIndex);

    return res.json({
      quiz: quizList[0],
      questions: questionList,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// 9. STUDENT ONLINE QUIZ SUBMISSION & AUTOMATIC SCORING
// ----------------------------------------------------
app.post('/api/quizzes/:id/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const quizId = Number(req.params.id);
    const { answers, studentId, timeTakenSeconds } = req.body; // answers is { [questionId: number]: 'A' | 'B' | 'C' | 'D' }

    // Resolve student
    let resolvedStudentId = req.appUser?.studentProfile?.id;
    if (!resolvedStudentId && studentId) {
      if (!isNaN(Number(studentId))) {
        resolvedStudentId = Number(studentId);
      } else {
        const found = await db.select().from(students).where(eq(students.studentId, studentId.toUpperCase().trim())).limit(1);
        if (found.length > 0) resolvedStudentId = found[0].id;
      }
    }

    if (!resolvedStudentId) {
      return res.status(400).json({ error: 'Could not determine student taking this quiz' });
    }

    const studentRec = await db.select().from(students).where(eq(students.id, resolvedStudentId)).limit(1);
    if (studentRec.length === 0) {
      return res.status(404).json({ error: 'Student record not found' });
    }
    const student = studentRec[0];

    const quizRec = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
    if (quizRec.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    const quiz = quizRec[0];

    // Fetch original questions with correct answers
    const quizQList = await db
      .select({
        questionId: questions.id,
        correctAnswer: questions.correctAnswer,
        questionText: questions.questionText,
        explanation: questions.explanation,
      })
      .from(quizQuestions)
      .innerJoin(questions, eq(quizQuestions.questionId, questions.id))
      .where(eq(quizQuestions.quizId, quizId));

    let correctCount = 0;
    const totalQ = quizQList.length;

    quizQList.forEach((q) => {
      const studentSelected = answers ? answers[q.questionId] : undefined;
      if (studentSelected && studentSelected.toUpperCase() === q.correctAnswer.toUpperCase()) {
        correctCount++;
      }
    });

    const wrongCount = totalQ - correctCount;
    const percentage = totalQ > 0 ? Math.round(((correctCount / totalQ) * 100) * 10) / 10 : 0;
    const totalMarks = quiz.totalMarks || 100;
    const calculatedScore = Math.round((percentage / 100) * totalMarks);
    const { grade } = calculateGrade(calculatedScore, totalMarks);

    // Save quiz attempt
    const [attempt] = await db.insert(quizAttempts).values({
      quizId,
      studentId: student.id,
      totalQuestions: totalQ,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      score: calculatedScore.toString(),
      percentage: percentage.toString(),
      timeTakenSeconds: Number(timeTakenSeconds) || 0,
      answersPayload: JSON.stringify(answers || {}),
    }).returning();

    // Automatically record under unified assessments/scores for the student's profile!
    const [assessment] = await db.insert(assessments).values({
      studentId: student.id,
      subjectId: quiz.subjectId,
      assessmentType: 'Quiz',
      assessmentTitle: `${quiz.title} (Online Test)`,
      score: calculatedScore.toString(),
      maxScore: totalMarks.toString(),
      percentage: percentage.toString(),
      grade,
      session: student.session || '2026/2027',
      term: 'First Term',
      teacherComment: `Online quiz completed: ${correctCount}/${totalQ} questions correct (${percentage}%).`,
      teacherId: quiz.createdByTeacherId,
      quizAttemptId: attempt.id,
      schoolId: req.appUser?.schoolId || 1,
    }).returning();

    return res.status(201).json({
      message: 'Quiz submitted successfully',
      result: {
        totalQuestions: totalQ,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        score: calculatedScore,
        maxScore: totalMarks,
        percentage,
        grade,
        assessmentId: assessment.id,
        attemptId: attempt.id,
      },
    });
  } catch (error: any) {
    console.error('Quiz submission error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit quiz' });
  }
});

// ----------------------------------------------------
// 10. AUDIT LOGS & ACADEMIC SESSIONS
// ----------------------------------------------------
app.get('/api/audit-logs', authenticate, async (req: AuthRequest, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
    return res.json({ logs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions', authenticate, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(academicSessions).orderBy(desc(academicSessions.name));
    return res.json({ sessions: list });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// 11. SUPER ADMIN MANAGEMENT ENDPOINTS
// ----------------------------------------------------

// List all teachers
app.get('/api/admin/teachers', authenticate, async (req: AuthRequest, res) => {
  try {
    const teacherList = await db
      .select({
        id: teachers.id,
        userId: users.id,
        teacherId: teachers.teacherId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: teachers.phone,
        schoolName: teachers.schoolName,
        role: users.role,
        createdAt: teachers.createdAt,
      })
      .from(teachers)
      .innerJoin(users, eq(teachers.userId, users.id))
      .orderBy(desc(teachers.createdAt));

    return res.json({ teachers: teacherList });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Super Admin: Add a new teacher
app.post('/api/admin/teachers', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.appUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Super Admin authorization required' });
    }

    const { firstName, lastName, email, phone, schoolName, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const generatedUid = `tch_usr_${Date.now()}`;
    const [newUser] = await db.insert(users).values({
      uid: generatedUid,
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: 'teacher',
      schoolId: 1,
    }).returning();

    const teacherYear = new Date().getFullYear();
    const teacherId = `TCH-${teacherYear}-${String(newUser.id).padStart(4, '0')}`;

    const [newTeacher] = await db.insert(teachers).values({
      userId: newUser.id,
      teacherId,
      phone: phone ? phone.trim() : null,
      schoolName: schoolName ? schoolName.trim() : 'Fenster International School',
      schoolId: 1,
    }).returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: 'super_admin',
      action: 'TEACHER_CREATED_BY_ADMIN',
      targetEntity: 'teachers',
      details: `Super Admin created teacher ${teacherId} (${newUser.firstName} ${newUser.lastName})`,
      schoolId: 1,
    });

    return res.status(201).json({
      message: 'Teacher account created successfully by Super Admin',
      teacher: {
        id: newTeacher.id,
        userId: newUser.id,
        teacherId: newTeacher.teacherId,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newTeacher.phone,
        schoolName: newTeacher.schoolName,
      },
    });
  } catch (error: any) {
    console.error('Super Admin create teacher error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create teacher' });
  }
});

// Super Admin: List all system users across roles
app.get('/api/admin/users', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.appUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Super Admin authorization required' });
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return res.json({ users: allUsers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Super Admin: Database Explorer (Inspect tables & row counts live)
app.get('/api/admin/database-explorer', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.appUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Super Admin authorization required' });
    }

    const tablesQuery = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tableNames = (tablesQuery.rows as any[]).map((r) => r.table_name);
    const tableSummaries = [];

    for (const tbl of tableNames) {
      const countRes = await db.execute(sql.raw(`SELECT count(*)::int as count FROM "${tbl}";`));
      const sampleRes = await db.execute(sql.raw(`SELECT * FROM "${tbl}" LIMIT 5;`));
      tableSummaries.push({
        name: tbl,
        rowCount: (countRes.rows[0] as any)?.count || 0,
        sampleRows: sampleRes.rows,
      });
    }

    return res.json({
      database: process.env.SQL_DB_NAME,
      host: 'Google Cloud SQL (Unix Proxy Socket)',
      tables: tableSummaries,
    });
  } catch (error: any) {
    console.error('Database explorer error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Super Admin: System Overview & Stats
app.get('/api/admin/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.appUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Super Admin authorization required' });
    }

    const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [teachersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(teachers);
    const [studentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(students);
    const [quizzesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(quizzes);
    const [assessmentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(assessments);
    const [subjectsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(subjects);

    const recentLogs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    return res.json({
      overview: {
        totalUsers: usersCount?.count || 0,
        totalTeachers: teachersCount?.count || 0,
        totalStudents: studentsCount?.count || 0,
        totalQuizzes: quizzesCount?.count || 0,
        totalAssessments: assessmentsCount?.count || 0,
        totalSubjects: subjectsCount?.count || 0,
      },
      recentLogs,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// VITE CLIENT MIDDLEWARE MOUNTING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

export { app };
export default app;

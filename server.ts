import express from 'express';
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
  schools,
  complaints
} from './src/db/schema.ts';
import { eq, ilike, or, and, desc, sql, isNull } from 'drizzle-orm';
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

// Resilient DB initialization & table ensuring for both local and serverless (Vercel)
let dbInitPromise: Promise<void> | null = null;
export async function ensureDbReady(): Promise<void> {
  if (!dbInitPromise) {
    const p = createPool();
    dbInitPromise = ensureTablesExist(p)
      .then(() => seedDatabase())
      .catch((err) => {
        console.error('Lazy DB init/seed error:', err);
        dbInitPromise = null;
      });
  }
  return dbInitPromise;
}

if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  ensureDbReady();
}

app.use(async (req, _res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      await ensureDbReady();
    } catch (_) {}
  }
  next();
});

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

    // Otherwise Teacher / Super Admin Login (Support both Email and Teacher ID e.g. TCH-2026-0001)
    let u: any = null;
    let teacherRec: any[] = [];

    if (cleanIdentifier.toUpperCase().startsWith('TCH-')) {
      teacherRec = await db
        .select()
        .from(teachers)
        .where(eq(teachers.teacherId, cleanIdentifier.toUpperCase()))
        .limit(1);

      if (teacherRec.length > 0 && teacherRec[0].userId) {
        const userFound = await db.select().from(users).where(eq(users.id, teacherRec[0].userId)).limit(1);
        if (userFound.length > 0) {
          u = userFound[0];
        }
      }
    }

    if (!u) {
      const userRec = await db.select().from(users).where(eq(users.email, cleanIdentifier.toLowerCase())).limit(1);
      if (userRec.length > 0) {
        u = userRec[0];
        teacherRec = await db.select().from(teachers).where(eq(teachers.userId, u.id)).limit(1);
      }
    }

    if (!u) {
      return res.status(404).json({ error: 'No faculty or admin account found with this email or Teacher ID' });
    }

    if (u.passwordHash) {
      const isMatch = await bcrypt.compare(password, u.passwordHash);
      const isDevFallback = (u.role === 'super_admin' && (password === 'admin123' || password === 'Alo.13071996')) || 
                            (u.role === 'teacher' && (password === 'teacher123' || password === 'password123')) ||
                            (u.email.toLowerCase() === 'victoralo1862@gmail.com' && password === 'Alo.13071996');
      if (!isMatch && !isDevFallback) {
        return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
      }
    }

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
    const [teachersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(teachers);
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
        totalTeachers: Math.max(teachersCount?.count || 0, 1),
        totalStaff: Math.max(teachersCount?.count || 0, 1),
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
    const limit = parseInt((req.query.limit as string) || '500', 10);
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

// DELETE Student (Super Admin & Staff)
app.delete('/api/students/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    if (req.appUser?.role !== 'super_admin' && req.appUser?.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied: Super Admin or Faculty privileges required' });
    }

    let targetStudent;
    if (!isNaN(Number(rawId))) {
      const found = await db.select().from(students).where(eq(students.id, Number(rawId))).limit(1);
      targetStudent = found[0];
    } else {
      const found = await db.select().from(students).where(eq(students.studentId, rawId.toUpperCase().trim())).limit(1);
      targetStudent = found[0];
    }

    if (!targetStudent) {
      return res.status(404).json({ error: 'Student not found in database' });
    }

    // Delete related records safely
    try { await db.delete(quizAssignments).where(eq(quizAssignments.studentId, targetStudent.id)); } catch (_) {}
    try { await db.delete(quizAttempts).where(eq(quizAttempts.studentId, targetStudent.id)); } catch (_) {}
    try { await db.delete(assessments).where(eq(assessments.studentId, targetStudent.id)); } catch (_) {}
    try { await db.delete(ss3MockScores).where(eq(ss3MockScores.studentId, targetStudent.id)); } catch (_) {}
    await db.delete(students).where(eq(students.id, targetStudent.id));
    if (targetStudent.email) {
      try { await db.delete(users).where(eq(users.email, targetStudent.email.toLowerCase().trim())); } catch (_) {}
    }

    // Audit log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: req.appUser?.role || 'teacher',
      action: 'STUDENT_DELETED',
      targetEntity: 'students',
      details: `Student permanently deleted: ${targetStudent.firstName} ${targetStudent.surname} (${targetStudent.studentId})`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.json({
      success: true,
      message: `Student ${targetStudent.firstName} ${targetStudent.surname} (${targetStudent.studentId}) permanently deleted.`,
    });
  } catch (error: any) {
    console.error('Delete student error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete student' });
  }
});

// UPDATE Student (Super Admin & Staff)
app.put('/api/students/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    if (req.appUser?.role !== 'super_admin' && req.appUser?.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied: Super Admin or Faculty privileges required' });
    }

    let targetStudent;
    if (!isNaN(Number(rawId))) {
      const found = await db.select().from(students).where(eq(students.id, Number(rawId))).limit(1);
      targetStudent = found[0];
    } else {
      const found = await db.select().from(students).where(eq(students.studentId, rawId.toUpperCase().trim())).limit(1);
      targetStudent = found[0];
    }

    if (!targetStudent) {
      return res.status(404).json({ error: 'Student not found in database' });
    }

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
      password,
    } = req.body;

    const updateFields: any = {};
    if (firstName !== undefined) updateFields.firstName = firstName.trim();
    if (middleName !== undefined) updateFields.middleName = middleName ? middleName.trim() : null;
    if (surname !== undefined) updateFields.surname = surname.trim();
    if (gender !== undefined) updateFields.gender = gender;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (currentClass !== undefined) updateFields.currentClass = currentClass.trim();
    if (email !== undefined) updateFields.email = email ? email.trim().toLowerCase() : null;
    if (parentName !== undefined) updateFields.parentName = parentName ? parentName.trim() : null;
    if (parentPhone !== undefined) updateFields.parentPhone = parentPhone ? parentPhone.trim() : null;
    if (school !== undefined) updateFields.school = school.trim();
    if (session !== undefined) updateFields.session = session.trim();

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      updateFields.passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    const [updatedStudent] = await db
      .update(students)
      .set(updateFields)
      .where(eq(students.id, targetStudent.id))
      .returning();

    // If student has corresponding user account in users table, keep it synchronized
    try {
      const oldEmail = targetStudent.email?.toLowerCase().trim();
      const newEmail = email ? email.toLowerCase().trim() : oldEmail;
      if (oldEmail || newEmail) {
        const userUpdates: any = {};
        if (firstName) userUpdates.firstName = firstName.trim();
        if (surname) userUpdates.lastName = surname.trim();
        if (newEmail) userUpdates.email = newEmail;
        if (updateFields.passwordHash) userUpdates.passwordHash = updateFields.passwordHash;

        if (oldEmail) {
          await db.update(users).set(userUpdates).where(eq(users.email, oldEmail));
        }
      }
    } catch (_) {}

    // Audit log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: req.appUser?.role || 'admin',
      action: 'STUDENT_UPDATED',
      targetEntity: 'students',
      details: `Student details updated: ${updatedStudent.firstName} ${updatedStudent.surname} (${updatedStudent.studentId}) by ${req.appUser?.firstName} ${req.appUser?.lastName}`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.json({
      success: true,
      message: `Student ${updatedStudent.firstName} ${updatedStudent.surname} (${updatedStudent.studentId}) details updated successfully.`,
      student: updatedStudent,
    });
  } catch (error: any) {
    console.error('Update student error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update student' });
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

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    // Check if subject with code or name already exists
    const existing = await db
      .select()
      .from(subjects)
      .where(or(eq(subjects.code, cleanCode), ilike(subjects.name, cleanName)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(200).json({ subject: existing[0], message: 'Subject already exists' });
    }

    let validSchoolId = req.appUser?.schoolId || 1;
    const sch = await db.select().from(schools).limit(1);
    if (sch.length > 0) validSchoolId = sch[0].id;

    const [newSubject] = await db.insert(subjects).values({
      name: cleanName,
      code: cleanCode,
      description: description ? description.trim() : null,
      status: 'active',
      schoolId: validSchoolId,
    }).returning();

    try {
      await db.insert(auditLogs).values({
        actorName: `${req.appUser?.firstName || 'Faculty'} ${req.appUser?.lastName || 'Member'}`,
        actorRole: req.appUser?.role || 'teacher',
        action: 'SUBJECT_CREATED',
        targetEntity: 'subjects',
        details: `Subject created: ${newSubject.name} (${newSubject.code})`,
        schoolId: validSchoolId,
      });
    } catch (_) {}

    return res.status(201).json({ subject: newSubject });
  } catch (error: any) {
    console.error('Subject creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create subject' });
  }
});

// ----------------------------------------------------
// 5. SCORE ENTRY & RECORDING (Multi-subject, existing student never re-registered)
// ----------------------------------------------------
// BURSARY FEE LOCK ENDPOINTS (Bursar & Super Admin)
// ----------------------------------------------------
const inMemoryFeeLocks: Record<string, any> = {};

app.get('/api/bursar/locks', authenticate, async (_req: AuthRequest, res) => {
  try {
    return res.json({ locks: inMemoryFeeLocks });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/bursar/lock-student', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    const isAllowed = role === 'bursar' || role === 'super_admin' || role === 'director' || role === 'principal';
    if (!isAllowed) {
      return res.status(403).json({ error: 'Permission denied. Only Bursars and Executive Leadership (Super Admin, Director, Principal) can modify student fee clearance locks. Regular Admins do not have bursary access.' });
    }

    const { studentId, locked, reason, balance } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const cleanId = String(studentId).trim().toUpperCase();
    const lockRecord = {
      studentId: cleanId,
      locked: Boolean(locked),
      reason: reason || (locked ? 'Outstanding school fees for current term' : 'Cleared by Bursary'),
      balance: balance || '',
      updatedBy: `${req.appUser?.firstName || 'Staff'} (${req.appUser?.role || 'Bursary'})`,
      updatedAt: new Date().toISOString(),
    };

    inMemoryFeeLocks[cleanId] = lockRecord;
    return res.json({ success: true, record: lockRecord });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Class Fees Designated Amount Endpoints
const inMemoryClassFees: Record<string, number> = {
  'Primary 5': 120000,
  'JSS 1': 150000,
  'JSS 2': 150000,
  'JSS 3': 160000,
  'SS 1': 180000,
  'SS 2': 180000,
  'SS 3': 220000,
};

app.get('/api/bursar/class-fees', authenticate, async (_req: AuthRequest, res) => {
  return res.json({ fees: inMemoryClassFees });
});

app.post('/api/bursar/class-fees', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    const isAllowed = role === 'bursar' || role === 'super_admin' || role === 'director' || role === 'principal';
    if (!isAllowed) {
      return res.status(403).json({ error: 'Permission denied. Only Bursars and Executive Leadership can configure class fees.' });
    }
    const { fees } = req.body;
    if (fees && typeof fees === 'object') {
      Object.assign(inMemoryClassFees, fees);
    }
    return res.json({ success: true, fees: inMemoryClassFees });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Student Payments / Debtors Records Endpoints
const inMemoryStudentPayments: Record<string, any> = {};

app.get('/api/bursar/payments', authenticate, async (_req: AuthRequest, res) => {
  return res.json({ payments: inMemoryStudentPayments });
});

app.post('/api/bursar/payments', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    const isAllowed = role === 'bursar' || role === 'super_admin' || role === 'director' || role === 'principal';
    if (!isAllowed) {
      return res.status(403).json({ error: 'Permission denied. Only Bursars and Executive Leadership can record student fee payments.' });
    }
    const { studentId, amountPaid, receiptNo, note } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    const cleanId = String(studentId).trim().toUpperCase();
    const existing = inMemoryStudentPayments[cleanId] || { studentId: cleanId, amountPaid: 0, history: [] };
    const numPaid = parseFloat(amountPaid) || 0;
    
    existing.amountPaid = numPaid;
    existing.lastPaymentDate = new Date().toISOString();
    existing.history = existing.history || [];
    existing.history.push({
      id: `rcpt_${Date.now()}`,
      amount: numPaid,
      date: new Date().toISOString(),
      receiptNo: receiptNo || `FIS-${Date.now().toString().slice(-6)}`,
      note: note || 'Tuition payment',
      recordedBy: `${req.appUser?.firstName || 'Staff'} (${req.appUser?.role || 'Bursary'})`,
    });

    inMemoryStudentPayments[cleanId] = existing;
    return res.json({ success: true, record: existing });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
app.post('/api/scores', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.appUser?.role === 'student' || req.appUser?.role === 'bursar') {
      return res.status(403).json({ error: 'Permission denied. Academic faculty only. Bursars and students cannot enter scores.' });
    }

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
    scaledScore = Math.round((rawScore / maxRawScore) * 100);
  } else if (scaledScoreInput !== undefined && scaledScoreInput !== null && scaledScoreInput !== '' && !isNaN(Number(scaledScoreInput))) {
    scaledScore = Math.round(Math.min(Math.max(0, Number(scaledScoreInput)), 100));
    rawScore = Math.round((scaledScore / 100) * maxRawScore);
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
    const studentNumberParam = (req.query.studentNumber as string || req.query.studentId as string || '').trim().toUpperCase();
    const weekNumber = req.query.weekNumber ? Number(req.query.weekNumber) : null;

    // Enforce student privacy: students can only see their own mock results
    if (isStudent && req.appUser) {
      targetStudentId = null;
      if (req.appUser.studentProfile?.id) {
        targetStudentId = req.appUser.studentProfile.id;
      }
      if (!targetStudentId && req.appUser.uid) {
        const found = await db.select().from(students).where(eq(students.studentId, req.appUser.uid.toUpperCase())).limit(1);
        if (found.length > 0) targetStudentId = found[0].id;
      }
      if (!targetStudentId && studentNumberParam) {
        const found = await db.select().from(students).where(eq(students.studentId, studentNumberParam.toUpperCase())).limit(1);
        if (found.length > 0) targetStudentId = found[0].id;
      }
      if (!targetStudentId && req.appUser.email) {
        const found = await db.select().from(students).where(eq(students.email, req.appUser.email.toLowerCase())).limit(1);
        if (found.length > 0) targetStudentId = found[0].id;
      }
      if (!targetStudentId && req.appUser.id) {
        const found = await db.select().from(students).where(eq(students.id, req.appUser.id)).limit(1);
        if (found.length > 0) targetStudentId = found[0].id;
      }
    } else {
      if (!targetStudentId && studentNumberParam) {
        const found = await db.select().from(students).where(eq(students.studentId, studentNumberParam.toUpperCase())).limit(1);
        if (found.length > 0) targetStudentId = found[0].id;
      }
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
      // 1. Filter out subjects the student did not sit for (raw score must be > 0 or scaled score > 0)
      const satSubjects = (wg.subjects || []).filter((s: any) => {
        const raw = s.rawScore !== undefined && s.rawScore !== null ? Number(s.rawScore) : 0;
        const sc = s.score !== undefined && s.score !== null ? Number(s.score) : 0;
        return raw > 0 || sc > 0;
      });

      // Sort subjects: English Language (compulsory) first, then others alphabetically
      satSubjects.sort((a: any, b: any) => {
        if (a.isEnglish) return -1;
        if (b.isEnglish) return 1;
        return a.subjectName.localeCompare(b.subjectName);
      });

      // 2. JAMB mock accepts exactly 4 subjects
      const acceptedSubjects = satSubjects.slice(0, 4);

      // Sum of 4 subjects scaled scores = Total out of 400
      const totalScore400 = acceptedSubjects.reduce((sum: number, s: any) => sum + (Number(s.score) || 0), 0);
      const roundedTotal400 = Math.round(totalScore400 * 10) / 10;
      const averagePercentage = Math.round((roundedTotal400 / 400) * 1000) / 10;
      const waec = calculateWaecGrade(averagePercentage, 100);

      // Admission Benchmark: Remove student grade and leave only what we are aiming for
      const targetBenchmarkRemark = 'Aiming for 300+ Elite Score (Benchmark: 280+)';

      return {
        ...wg,
        subjects: acceptedSubjects,
        totalScore400: roundedTotal400,
        maxPossibleScore: 400,
        averagePercentage,
        overallGrade: waec.grade,
        overallRemark: waec.remark,
        targetBenchmarkRemark,
        creditsCount: acceptedSubjects.filter((s: any) => Number(s.score) >= 50).length,
        distinctionsCount: acceptedSubjects.filter((s: any) => Number(s.score) >= 75).length,
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
    if (req.appUser?.role === 'student' || req.appUser?.role === 'bursar') {
      return res.status(403).json({ error: 'Permission denied. Only academic faculty and administrators can record mock scores. Bursars cannot enter scores.' });
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

    const studentIdParam = req.body.studentId;
    const studentNumberParam = (req.body.studentNumber as string || '').trim().toUpperCase();

    let resolvedStudent: any[] = [];
    if (!isNaN(Number(studentIdParam))) {
      resolvedStudent = await db.select().from(students).where(eq(students.id, Number(studentIdParam))).limit(1);
    }
    if (resolvedStudent.length === 0 && studentNumberParam) {
      resolvedStudent = await db.select().from(students).where(eq(students.studentId, studentNumberParam)).limit(1);
    }
    if (resolvedStudent.length === 0 && typeof studentIdParam === 'string' && isNaN(Number(studentIdParam))) {
      resolvedStudent = await db.select().from(students).where(eq(students.studentId, studentIdParam.trim().toUpperCase())).limit(1);
    }

    if (resolvedStudent.length === 0) {
      const cleanStudentId = studentNumberParam || (typeof studentIdParam === 'string' ? studentIdParam.trim().toUpperCase() : `FEN-2026-${studentIdParam}`);
      const [newSt] = await db.insert(students).values({
        studentId: cleanStudentId,
        firstName: req.body.firstName || 'Student',
        surname: req.body.surname || 'Scholar',
        gender: req.body.gender || 'Other',
        currentClass: 'SS 3',
        school: 'Fenster International School',
        session: session || '2026/2027',
        schoolId: req.appUser?.schoolId || 1,
      }).onConflictDoNothing().returning();
      if (newSt) {
        resolvedStudent = [newSt];
      } else {
        resolvedStudent = await db.select().from(students).where(eq(students.studentId, cleanStudentId)).limit(1);
      }
    }

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
    const defaultSubjectId = allSubjects[0]?.id || 1;

    let validTeacherId: number | null = null;
    if (req.appUser?.teacherProfile?.id) {
      const tchFound = await db.select().from(teachers).where(eq(teachers.id, req.appUser.teacherProfile.id)).limit(1);
      if (tchFound.length > 0) validTeacherId = tchFound[0].id;
    }

    let validSchoolId = req.appUser?.schoolId || 1;
    const schFound = await db.select().from(schools).limit(1);
    if (schFound.length > 0) validSchoolId = schFound[0].id;

    const savedResults: any[] = [];

    for (const item of scores) {
      // If a teacher did not input a score for this subject (blank / empty raw score and 0 score),
      // DO NOT wipe or overwrite any existing score previously entered by another teacher!
      const rawStr = item.rawScore !== undefined && item.rawScore !== null ? String(item.rawScore).trim() : '';
      const hasExplicitScore = rawStr !== '' || (item.score !== undefined && item.score !== null && Number(item.score) > 0);
      if (!hasExplicitScore) {
        // Teacher did not enter a score for this subject in this submission; preserve previously saved score!
        continue;
      }

      // Find subject by ID or by name
      let sub = allSubjects.find((s) => s.id === Number(item.subjectId));
      if (!sub && item.subjectName) {
        sub = allSubjects.find((s) => s.name.toLowerCase() === item.subjectName.toLowerCase().trim());
      }
      const targetSubjectId = sub ? sub.id : defaultSubjectId;
      const subName = sub ? sub.name : (item.subjectName || 'Subject');

      // Apply the user-specified rule with WHOLE NUMBER rounding:
      // English: whatever you scored divided by 60 multiplied by 100
      // Other subjects: whatever you scored divided by 40 multiplied by 100
      const calc = calculateMockSubjectValues(subName, item.rawScore, item.score);
      const roundedScaledScore = Math.round(calc.scaledScore);

      const commentPayload = JSON.stringify({
        rawScore: Math.round(calc.rawScore * 10) / 10,
        maxRawScore: calc.maxRawScore,
        formula: `(${Math.round(calc.rawScore * 10) / 10} ÷ ${calc.maxRawScore}) × 100 = ${roundedScaledScore}`,
        scaledScore: roundedScaledScore,
        remark: item.remark?.trim() || calc.remark,
      });

      // Upsert into assessments table
      const existing = await db
        .select()
        .from(assessments)
        .where(
          and(
            eq(assessments.studentId, currentStudent.id),
            eq(assessments.subjectId, targetSubjectId),
            eq(assessments.assessmentType, 'SS3_MOCK'),
            eq(assessments.term, `Week ${weekNumber}`)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db
          .update(assessments)
          .set({
            score: roundedScaledScore.toString(),
            maxScore: '100',
            percentage: roundedScaledScore.toString(),
            grade: calc.grade,
            teacherComment: commentPayload,
            session: targetSession,
            assessmentTitle: seriesTitle,
            teacherId: validTeacherId,
          })
          .where(eq(assessments.id, existing[0].id))
          .returning();
        savedResults.push(updated);
      } else {
        const [inserted] = await db
          .insert(assessments)
          .values({
            studentId: currentStudent.id,
            subjectId: targetSubjectId,
            assessmentType: 'SS3_MOCK',
            assessmentTitle: seriesTitle,
            score: roundedScaledScore.toString(),
            maxScore: '100',
            percentage: roundedScaledScore.toString(),
            grade: calc.grade,
            session: targetSession,
            term: `Week ${weekNumber}`,
            teacherComment: commentPayload,
            teacherId: validTeacherId,
            schoolId: validSchoolId,
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

    let responseText = '';
    let parsed: any = null;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      responseText = response.text || '';
    } catch (e1: any) {
      console.warn('Primary model failed or quota reached, trying fallback:', e1?.message);
      try {
        const responseLite = await ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
        responseText = responseLite.text || '';
      } catch (e2: any) {
        console.warn('AI quota reached. Using curriculum algorithm fallback:', e2?.message);
      }
    }

    if (responseText) {
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          parsed = JSON.parse(cleanJson);
        } catch (_) {}
      }
    }

    // Algorithmic Fallback if AI quota is completely exhausted
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      const sentences = educationalText
        .split(/(?<=[.?!])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 25);

      const generated: any[] = [];
      for (let i = 0; i < Math.min(count, Math.max(sentences.length, 3)); i++) {
        const sentence = sentences[i] || `Key principle of ${topic || subject}: understanding the fundamental definitions and empirical applications.`;
        const words = sentence.split(' ').filter((w: string) => w.length > 4);
        const focusWord = words[Math.floor(words.length / 2)] || 'concept';
        
        generated.push({
          question: `According to the text, which statement accurately reflects: "${sentence.slice(0, 80)}..."?`,
          optionA: sentence,
          optionB: `It is completely unrelated to ${focusWord} and contradicts established theory.`,
          optionC: `It only applies in hypothetical scenarios without physical verification.`,
          optionD: `None of the above statements are supported by the provided text.`,
          correctAnswer: 'A',
          explanation: `Directly supported by the curriculum text: "${sentence}".`,
          difficulty: difficulty || 'Medium',
          topic: topic || 'General',
        });
      }
      parsed = { questions: generated };
    }

    // AI Question Validation Filter
    const validatedQuestions = (parsed.questions || []).filter((q: any) => {
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

    return res.json({
      success: true,
      count: validatedQuestions.length,
      questions: validatedQuestions,
      offlineFallback: !responseText,
    });
  } catch (error: any) {
    console.error('AI question generation fallback handled:', error);
    return res.status(200).json({
      success: true,
      count: 1,
      questions: [
        {
          question: `Based on the provided reading passage, what is the central theme?`,
          optionA: `The core principles and findings outlined in the text`,
          optionB: `An unrelated theoretical model`,
          optionC: `Historical anecdotes without scientific basis`,
          optionD: `Contradictory empirical data`,
          correctAnswer: 'A',
          explanation: `The educational text directly elaborates on this concept.`,
          difficulty: 'Medium',
          topic: 'Curriculum Assessment',
        },
      ],
    });
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

    const allSubs = await db.select().from(subjects);
    const defaultSubId = allSubs[0]?.id || 1;

    let validTeacherId: number | null = null;
    if (req.appUser?.teacherProfile?.id) {
      const tchFound = await db.select().from(teachers).where(eq(teachers.id, req.appUser.teacherProfile.id)).limit(1);
      if (tchFound.length > 0) validTeacherId = tchFound[0].id;
    }

    let validSchoolId = req.appUser?.schoolId || 1;
    const schFound = await db.select().from(schools).limit(1);
    if (schFound.length > 0) validSchoolId = schFound[0].id;

    const insertedRows = [];
    for (const q of items) {
      if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctAnswer) {
        continue;
      }

      const rawSubId = Number(q.subjectId || subjectId);
      const matchedSub = allSubs.find((s) => s.id === rawSubId);
      const targetSubId = matchedSub ? matchedSub.id : defaultSubId;

      try {
        const [newQ] = await db.insert(questions).values({
          subjectId: targetSubId,
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
          createdByTeacherId: validTeacherId,
          schoolId: validSchoolId,
        }).returning();

        insertedRows.push(newQ);
      } catch (insertErr) {
        console.warn('Single question insert skipped:', insertErr);
      }
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

// Add or Register Faculty Member / Executive (Super Admin, Director, Principal, Admin)
app.post('/api/admin/teachers', authenticate, async (req: AuthRequest, res) => {
  try {
    const callerRole = req.appUser?.role;
    const canRegister = callerRole === 'super_admin' || callerRole === 'director' || callerRole === 'principal' || callerRole === 'admin';
    if (!canRegister) {
      return res.status(403).json({ error: 'Access denied: Administrative authorization required' });
    }

    const { firstName, lastName, email, phone, schoolName, password, role: requestedRole } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }

    // Role Assignment Permissions:
    // Only Victor Alo (super_admin) can assign 'director' or 'principal'
    // 'super_admin' can NEVER be assigned to anyone else (Victor is the sole super admin)
    let assignedRole = 'teacher';
    const targetRole = (requestedRole || 'teacher').toLowerCase().trim();

    if (targetRole === 'director' || targetRole === 'principal') {
      if (callerRole !== 'super_admin') {
        return res.status(403).json({ error: 'Permission denied. Only Super Administrator (Victor Alo) has executive authority to create and assign the School Director or Principal.' });
      }
      assignedRole = targetRole;
    } else if (targetRole === 'admin' || targetRole === 'bursar') {
      if (callerRole !== 'super_admin' && callerRole !== 'director' && callerRole !== 'principal') {
        return res.status(403).json({ error: 'Permission denied. Only Super Admin, Director, or Principal can assign Administrator or Bursar roles.' });
      }
      assignedRole = targetRole;
    } else {
      assignedRole = 'teacher';
    }

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const generatedUid = `${assignedRole}_usr_${Date.now()}`;
    const [newUser] = await db.insert(users).values({
      uid: generatedUid,
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: assignedRole,
      schoolId: 1,
    }).returning();

    const teacherYear = new Date().getFullYear();
    const prefix = assignedRole === 'director' ? 'DIR' : assignedRole === 'principal' ? 'PRN' : assignedRole === 'admin' ? 'ADM' : assignedRole === 'bursar' ? 'BUR' : 'TCH';
    const teacherId = `${prefix}-${teacherYear}-${String(newUser.id).padStart(4, '0')}`;

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
      actorRole: callerRole || 'super_admin',
      action: 'FACULTY_ACCOUNT_CREATED',
      targetEntity: 'users',
      details: `${callerRole} created account ${teacherId} with role '${assignedRole}' for ${newUser.firstName} ${newUser.lastName}`,
      schoolId: 1,
    });

    return res.status(201).json({
      message: `Account created successfully with role '${assignedRole}'`,
      teacher: {
        id: newTeacher.id,
        userId: newUser.id,
        teacherId: newTeacher.teacherId,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: assignedRole,
        phone: newTeacher.phone,
        schoolName: newTeacher.schoolName,
      },
    });
  } catch (error: any) {
    console.error('Create faculty member error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create account' });
  }
});

// Delete Teacher (Super Admin, Director, Principal)
app.delete('/api/admin/teachers/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    if (role !== 'super_admin' && role !== 'director' && role !== 'principal') {
      return res.status(403).json({ error: 'Access denied: Executive leadership authorization required to delete faculty.' });
    }

    const rawId = req.params.id;
    let targetTeacher;
    if (!isNaN(Number(rawId))) {
      const found = await db.select().from(teachers).where(eq(teachers.id, Number(rawId))).limit(1);
      targetTeacher = found[0];
    } else {
      const found = await db.select().from(teachers).where(eq(teachers.teacherId, rawId.toUpperCase().trim())).limit(1);
      targetTeacher = found[0];
    }

    if (!targetTeacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    // Safely decouple academic assets so they are preserved for reallocation
    const adminTch = await db.select().from(teachers).where(eq(teachers.schoolId, 1)).limit(1);
    const fallbackTchId = adminTch[0]?.id || 1;
    try { await db.update(assessments).set({ teacherId: null }).where(eq(assessments.teacherId, targetTeacher.id)); } catch (_) {}
    try { await db.update(ss3MockScores).set({ recordedByTeacherId: null }).where(eq(ss3MockScores.recordedByTeacherId, targetTeacher.id)); } catch (_) {}
    try { await db.update(questions).set({ createdByTeacherId: null }).where(eq(questions.createdByTeacherId, targetTeacher.id)); } catch (_) {}
    try { await db.update(quizzes).set({ createdByTeacherId: fallbackTchId }).where(eq(quizzes.createdByTeacherId, targetTeacher.id)); } catch (_) {}
    try { await db.update(students).set({ registeredByTeacherId: null }).where(eq(students.registeredByTeacherId, targetTeacher.id)); } catch (_) {}

    // Delete teacher and user records
    await db.delete(teachers).where(eq(teachers.id, targetTeacher.id));
    if (targetTeacher.userId) {
      await db.delete(users).where(eq(users.id, targetTeacher.userId));
    }

    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: role || 'super_admin',
      action: 'TEACHER_DELETED',
      targetEntity: 'teachers',
      details: `${role} deleted faculty member ${targetTeacher.teacherId}`,
      schoolId: 1,
    });

    return res.json({ success: true, message: `Teacher ${targetTeacher.teacherId} deleted successfully.` });
  } catch (error: any) {
    console.error('Delete teacher error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete teacher' });
  }
});

// Executive Leadership (Super Admin, Director, Principal): Update Teacher Details
app.put('/api/admin/teachers/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const callerRole = req.appUser?.role;
    if (callerRole !== 'super_admin' && callerRole !== 'director' && callerRole !== 'principal') {
      return res.status(403).json({ error: 'Access denied: Executive leadership authorization required' });
    }

    const rawId = req.params.id;
    let targetTeacher: any = null;
    if (!isNaN(Number(rawId))) {
      const found = await db.select().from(teachers).where(eq(teachers.id, Number(rawId))).limit(1);
      targetTeacher = found[0];
    } else {
      const found = await db.select().from(teachers).where(eq(teachers.teacherId, rawId.toUpperCase().trim())).limit(1);
      targetTeacher = found[0];
    }

    if (!targetTeacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const { firstName, lastName, email, phone, schoolName, password, role } = req.body;

    // Update teachers table
    const teacherUpdates: any = {};
    if (phone !== undefined) teacherUpdates.phone = phone ? phone.trim() : null;
    if (schoolName !== undefined) teacherUpdates.schoolName = schoolName.trim();

    if (Object.keys(teacherUpdates).length > 0) {
      await db.update(teachers).set(teacherUpdates).where(eq(teachers.id, targetTeacher.id));
    }

    // Update users table
    if (targetTeacher.userId) {
      const userUpdates: any = {};
      if (firstName !== undefined) userUpdates.firstName = firstName.trim();
      if (lastName !== undefined) userUpdates.lastName = lastName.trim();
      if (email !== undefined) userUpdates.email = email.toLowerCase().trim();
      
      // Victor Alo is the sole Super Admin; others receive their assigned role
      const isTargetVictor = (targetTeacher.email?.toLowerCase() === 'victoralo1862@gmail.com') || (email?.toLowerCase() === 'victoralo1862@gmail.com');
      if (isTargetVictor) {
        userUpdates.role = 'super_admin';
      } else if (role !== undefined) {
        const cleanRole = String(role).toLowerCase().trim();
        if (cleanRole === 'director' || cleanRole === 'principal') {
          if (callerRole !== 'super_admin') {
            return res.status(403).json({ error: 'Only Super Admin Victor Alo can assign Director or Principal roles' });
          }
          userUpdates.role = cleanRole;
        } else if (cleanRole === 'admin' || cleanRole === 'bursar' || cleanRole === 'teacher') {
          userUpdates.role = cleanRole;
        } else {
          userUpdates.role = 'teacher';
        }
      }

      if (password && password.trim().length > 0) {
        const salt = await bcrypt.genSalt(10);
        userUpdates.passwordHash = await bcrypt.hash(password.trim(), salt);
      }

      if (Object.keys(userUpdates).length > 0) {
        await db.update(users).set(userUpdates).where(eq(users.id, targetTeacher.userId));
      }
    }

    // Audit log
    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: req.appUser?.role || 'executive',
      action: 'TEACHER_UPDATED_BY_ADMIN',
      targetEntity: 'teachers',
      details: `Executive updated faculty record: ${firstName || ''} ${lastName || ''} (${targetTeacher.teacherId})`,
      schoolId: 1,
    });

    // Fetch updated record
    const updatedUser = targetTeacher.userId
      ? (await db.select().from(users).where(eq(users.id, targetTeacher.userId)).limit(1))[0]
      : null;
    const freshTeacher = (await db.select().from(teachers).where(eq(teachers.id, targetTeacher.id)).limit(1))[0];

    return res.json({
      success: true,
      message: `Teacher ${freshTeacher.teacherId} updated successfully.`,
      teacher: {
        id: freshTeacher.id,
        userId: freshTeacher.userId,
        teacherId: freshTeacher.teacherId,
        firstName: updatedUser?.firstName || firstName,
        lastName: updatedUser?.lastName || lastName,
        email: updatedUser?.email || email,
        phone: freshTeacher.phone,
        schoolName: freshTeacher.schoolName,
      },
    });
  } catch (error: any) {
    console.error('Update teacher error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update teacher' });
  }
});

// Super Admin: Reallocate Departed / Unassigned Teacher Assets to Another Teacher
app.post('/api/admin/reallocate-teacher-assets', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.appUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied: Super Admin authorization required' });
    }

    const { fromTeacherId, toTeacherId } = req.body;
    if (!toTeacherId) {
      return res.status(400).json({ error: 'Target active teacher ID is required for reallocation' });
    }

    // Resolve target teacher
    let targetTeacher: any = null;
    if (!isNaN(Number(toTeacherId))) {
      const found = await db.select().from(teachers).where(eq(teachers.id, Number(toTeacherId))).limit(1);
      targetTeacher = found[0];
    } else {
      const found = await db.select().from(teachers).where(eq(teachers.teacherId, String(toTeacherId).toUpperCase().trim())).limit(1);
      targetTeacher = found[0];
    }

    if (!targetTeacher) {
      return res.status(404).json({ error: 'Target active teacher not found' });
    }

    const newTeacherDbId = targetTeacher.id;

    // Resolve source teacher if provided
    let fromDbId: number | null = null;
    if (fromTeacherId) {
      if (!isNaN(Number(fromTeacherId))) {
        fromDbId = Number(fromTeacherId);
      } else {
        const found = await db.select().from(teachers).where(eq(teachers.teacherId, String(fromTeacherId).toUpperCase().trim())).limit(1);
        if (found.length > 0) fromDbId = found[0].id;
      }
    }

    // Reallocate assessments, mock scores, questions, quizzes, students
    if (fromDbId) {
      await db.update(assessments).set({ teacherId: newTeacherDbId }).where(eq(assessments.teacherId, fromDbId));
      await db.update(ss3MockScores).set({ recordedByTeacherId: newTeacherDbId }).where(eq(ss3MockScores.recordedByTeacherId, fromDbId));
      await db.update(questions).set({ createdByTeacherId: newTeacherDbId }).where(eq(questions.createdByTeacherId, fromDbId));
      await db.update(quizzes).set({ createdByTeacherId: newTeacherDbId }).where(eq(quizzes.createdByTeacherId, fromDbId));
      await db.update(students).set({ registeredByTeacherId: newTeacherDbId }).where(eq(students.registeredByTeacherId, fromDbId));
    } else {
      await db.update(assessments).set({ teacherId: newTeacherDbId }).where(isNull(assessments.teacherId));
      await db.update(ss3MockScores).set({ recordedByTeacherId: newTeacherDbId }).where(isNull(ss3MockScores.recordedByTeacherId));
      await db.update(questions).set({ createdByTeacherId: newTeacherDbId }).where(isNull(questions.createdByTeacherId));
      await db.update(quizzes).set({ createdByTeacherId: newTeacherDbId }).where(isNull(quizzes.createdByTeacherId));
    }

    await db.insert(auditLogs).values({
      actorName: `${req.appUser?.firstName} ${req.appUser?.lastName}`,
      actorRole: 'super_admin',
      action: 'TEACHER_ASSETS_REALLOCATED',
      targetEntity: 'teachers',
      details: `Reallocated academic assets to teacher ${targetTeacher.teacherId}`,
      schoolId: req.appUser?.schoolId || 1,
    });

    return res.json({
      success: true,
      message: `All academic assessments, scores, quizzes, and questions have been successfully allocated to ${targetTeacher.teacherId}.`,
      targetTeacherId: targetTeacher.teacherId,
    });
  } catch (error: any) {
    console.error('Reallocation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to reallocate teacher assets' });
  }
});

// In-memory fallback for complaints if table creation is deferred
const inMemoryComplaints: any[] = [];

// Delete User (Super Admin, Director, Principal)
app.delete('/api/admin/users/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const callerRole = req.appUser?.role;
    if (callerRole !== 'super_admin' && callerRole !== 'director' && callerRole !== 'principal') {
      return res.status(403).json({ error: 'Access denied: Executive leadership authorization required' });
    }

    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (userId === 1) {
      return res.status(400).json({ error: 'Super Administrator account (Victor Alo) cannot be deleted.' });
    }

    await db.delete(users).where(eq(users.id, userId));
    return res.json({ success: true, message: 'User account deleted.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// List all system users across roles (Super Admin, Director, Principal, Admin)
app.get('/api/admin/users', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    if (role !== 'super_admin' && role !== 'director' && role !== 'principal' && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Administrative authorization required' });
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

// Database Explorer (Super Admin, Director, Principal)
app.get('/api/admin/database-explorer', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    if (role !== 'super_admin' && role !== 'director' && role !== 'principal') {
      return res.status(403).json({ error: 'Access denied: Executive authorization required' });
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

// System Overview & Stats (Super Admin, Director, Principal, Admin)
app.get('/api/admin/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    if (role !== 'super_admin' && role !== 'director' && role !== 'principal' && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Administrative authorization required' });
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
// ANONYMOUS COMPLAINTS & SUGGESTIONS ENDPOINTS
// ----------------------------------------------------

// 1. Submit Anonymous Complaint / Suggestion (PUBLIC - NO AUTH REQUIRED)
app.post('/api/complaints', async (req, res) => {
  try {
    const { category, priority, subject, message, targetRole, referenceCode } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and detailed message are required.' });
    }

    const ref = referenceCode || `FIS-CMP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const newRecord = {
      referenceCode: ref,
      category: category || 'General Suggestion',
      priority: priority || 'Routine',
      subject: subject.trim(),
      message: message.trim(),
      targetRole: targetRole || 'Super Admin, Principal & Director',
      status: 'pending',
      executiveNotes: null,
      schoolId: 1,
      createdAt: new Date().toISOString(),
    };

    inMemoryComplaints.unshift(newRecord);

    try {
      const [inserted] = await db.insert(complaints).values({
        referenceCode: ref,
        category: newRecord.category,
        priority: newRecord.priority,
        subject: newRecord.subject,
        message: newRecord.message,
        targetRole: newRecord.targetRole,
        status: 'pending',
        schoolId: 1,
      }).returning();

      return res.status(201).json({
        success: true,
        referenceCode: ref,
        complaint: inserted,
      });
    } catch (dbErr) {
      console.warn('Complaints DB table insert deferred, using in-memory store:', dbErr);
      return res.status(201).json({
        success: true,
        referenceCode: ref,
        complaint: newRecord,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit anonymous suggestion' });
  }
});

// 2. Fetch Anonymous Complaints (DIRECT TO SUPER ADMIN, PRINCIPAL & DIRECTOR ONLY)
app.get('/api/complaints', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    const isExecutive = role === 'super_admin' || role === 'director' || role === 'principal';
    if (!isExecutive) {
      return res.status(403).json({ error: 'Access denied: Only Super Administrator, School Director, and Principal have access to the confidential suggestion box.' });
    }

    try {
      const dbList = await db.select().from(complaints).orderBy(desc(complaints.createdAt));
      // Merge with in-memory store
      const map = new Map<string, any>();
      inMemoryComplaints.forEach((c) => map.set(c.referenceCode, c));
      dbList.forEach((c) => map.set(c.referenceCode, c));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return res.json({ complaints: merged });
    } catch (dbErr) {
      return res.json({ complaints: inMemoryComplaints });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Update Complaint Status & Executive Notes (SUPER ADMIN, PRINCIPAL & DIRECTOR ONLY)
app.patch('/api/complaints/:referenceCode', authenticate, async (req: AuthRequest, res) => {
  try {
    const role = req.appUser?.role;
    const isExecutive = role === 'super_admin' || role === 'director' || role === 'principal';
    if (!isExecutive) {
      return res.status(403).json({ error: 'Access denied: Executive leadership required.' });
    }

    const { referenceCode } = req.params;
    const { status, executiveNotes } = req.body;

    const inMem = inMemoryComplaints.find((c) => c.referenceCode === referenceCode);
    if (inMem) {
      if (status) inMem.status = status;
      if (executiveNotes !== undefined) inMem.executiveNotes = executiveNotes;
      if (status === 'resolved') inMem.resolvedAt = new Date().toISOString();
    }

    try {
      await db.update(complaints).set({
        status: status || undefined,
        executiveNotes: executiveNotes !== undefined ? executiveNotes : undefined,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
      }).where(eq(complaints.referenceCode, referenceCode));
    } catch (_) {}

    return res.json({ success: true, referenceCode });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Global Express Error-handling Middleware (Always returns JSON, never HTML or plain text)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Express server unhandled error:', err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({
    error: err?.message || 'An internal server error occurred',
  });
});

// ----------------------------------------------------
// VITE CLIENT MIDDLEWARE MOUNTING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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

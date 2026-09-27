import { db } from './index.ts';
import { schools, users, teachers, students, subjects, academicSessions, gradingRules } from './schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function seedDatabase() {
  try {
    // 1. Check or seed School
    const existingSchools = await db.select().from(schools).limit(1);
    let schoolId = 1;
    if (existingSchools.length === 0) {
      const [newSchool] = await db.insert(schools).values({
        name: 'Fenster International School',
        code: 'FEN',
        address: '10 Unity Way, Academic District',
      }).returning();
      schoolId = newSchool.id;
      console.log('Seeded School:', newSchool.name);
    } else {
      schoolId = existingSchools[0].id;
    }

    // 2. Check or seed Academic Session
    const existingSessions = await db.select().from(academicSessions).limit(1);
    if (existingSessions.length === 0) {
      await db.insert(academicSessions).values([
        { name: '2026/2027', isCurrent: true, schoolId },
        { name: '2025/2026', isCurrent: false, schoolId },
      ]);
    }

    // 3. Seed Default Grading Rules
    const existingGrades = await db.select().from(gradingRules).limit(1);
    if (existingGrades.length === 0) {
      await db.insert(gradingRules).values([
        { grade: 'A', minScore: '70', maxScore: '100', remark: 'Excellent', schoolId },
        { grade: 'B', minScore: '60', maxScore: '69.99', remark: 'Very Good', schoolId },
        { grade: 'C', minScore: '50', maxScore: '59.99', remark: 'Credit / Good', schoolId },
        { grade: 'D', minScore: '45', maxScore: '49.99', remark: 'Pass', schoolId },
        { grade: 'E', minScore: '40', maxScore: '44.99', remark: 'Fair', schoolId },
        { grade: 'F', minScore: '0', maxScore: '39.99', remark: 'Fail', schoolId },
      ]);
    }

    // 4. Seed Subjects
    const existingSubjects = await db.select().from(subjects).limit(1);
    if (existingSubjects.length === 0) {
      await db.insert(subjects).values([
        { name: 'Mathematics', code: 'MTH', description: 'Core Mathematics & Numeracy', status: 'active', schoolId },
        { name: 'English Language', code: 'ENG', description: 'Grammar, Comprehension, & Composition', status: 'active', schoolId },
        { name: 'Biology', code: 'BIO', description: 'Life Sciences and Living Organisms', status: 'active', schoolId },
        { name: 'Physics', code: 'PHY', description: 'Mechanics, Energy, and Physical World', status: 'active', schoolId },
        { name: 'Chemistry', code: 'CHM', description: 'Matter, Reactions, and Organic Chemistry', status: 'active', schoolId },
        { name: 'Digital Technology', code: 'DGT', description: 'Computing, Digital Systems, Information Technology & Innovation', status: 'active', schoolId },
        { name: 'ICT', code: 'ICT', description: 'Information & Communications Technology', status: 'active', schoolId },
        { name: 'Basic Science', code: 'BSC', description: 'Foundational integrated sciences for Junior secondary', status: 'active', schoolId },
        { name: 'Economics', code: 'ECO', description: 'Micro & Macroeconomics, Markets, and Trade', status: 'active', schoolId },
      ]);
      console.log('Seeded initial subjects');
    }

    // 5. Seed Super Admin & Demo Teacher
    const adminUser = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1);
    if (adminUser.length === 0) {
      const adminSalt = await bcrypt.genSalt(10);
      const adminPassHash = await bcrypt.hash('admin123', adminSalt);
      await db.insert(users).values({
        uid: 'super-admin-001',
        email: 'admin@school.edu',
        passwordHash: adminPassHash,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'super_admin',
        schoolId,
      });
      console.log('Seeded Super Admin: admin@school.edu / admin123');
    }

    const teacherUsers = await db.select().from(users).where(eq(users.role, 'teacher')).limit(1);
    let demoTeacherId = 1;

    if (teacherUsers.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('teacher123', salt);
      const [demoUser] = await db.insert(users).values({
        uid: 'demo-teacher-001',
        email: 'teacher@school.edu',
        passwordHash: hashedPassword,
        firstName: 'Sarah',
        lastName: 'Okonkwo',
        role: 'teacher',
        schoolId,
      }).returning();

      const [newTeacher] = await db.insert(teachers).values({
        userId: demoUser.id,
        teacherId: 'TCH-2026-0001',
        phone: '+2348012345678',
        schoolName: 'Fenster International School',
        schoolId,
      }).returning();
      demoTeacherId = newTeacher.id;
      console.log('Seeded demo teacher: teacher@school.edu / teacher123');
    } else {
      const t = await db.select().from(teachers).limit(1);
      if (t.length > 0) demoTeacherId = t[0].id;
    }

    // 6. Seed Sample Students with unique IDs (e.g. FEN-2026-000001, FEN-2026-000021)
    const existingStudents = await db.select().from(students).limit(1);
    if (existingStudents.length === 0) {
      const studentSalt = await bcrypt.genSalt(10);
      const defaultStudentHash = await bcrypt.hash('student123', studentSalt);

      await db.insert(students).values([
        {
          studentId: 'FEN-2026-000001',
          firstName: 'John',
          middleName: 'Michael',
          surname: 'Johnson',
          gender: 'Male',
          dateOfBirth: '2010-04-15',
          currentClass: 'SS 2',
          email: 'john.johnson@student.school.edu',
          parentName: 'Mr. Robert Johnson',
          parentPhone: '+2348033221100',
          school: 'Fenster International School',
          session: '2026/2027',
          passwordHash: defaultStudentHash,
          schoolId,
          registeredByTeacherId: demoTeacherId,
        },
        {
          studentId: 'FEN-2026-000002',
          firstName: 'Michael',
          middleName: 'David',
          surname: 'Johnson',
          gender: 'Male',
          dateOfBirth: '2011-08-20',
          currentClass: 'SS 1',
          email: 'michael.johnson@student.school.edu',
          parentName: 'Mrs. Grace Johnson',
          parentPhone: '+2348033221101',
          school: 'Fenster International School',
          session: '2026/2027',
          passwordHash: defaultStudentHash,
          schoolId,
          registeredByTeacherId: demoTeacherId,
        },
        {
          studentId: 'FEN-2026-000003',
          firstName: 'David',
          middleName: 'Emeka',
          surname: 'Johnson',
          gender: 'Male',
          dateOfBirth: '2014-02-10',
          currentClass: 'Primary 5',
          email: 'david.johnson@student.school.edu',
          parentName: 'Mr. & Mrs. Johnson',
          parentPhone: '+2348033221102',
          school: 'Fenster International School',
          session: '2026/2027',
          passwordHash: defaultStudentHash,
          schoolId,
          registeredByTeacherId: demoTeacherId,
        },
        {
          studentId: 'FEN-2026-000021',
          firstName: 'Amina',
          middleName: 'Zainab',
          surname: 'Bello',
          gender: 'Female',
          dateOfBirth: '2010-11-05',
          currentClass: 'SS 2',
          email: 'amina.bello@student.school.edu',
          parentName: 'Alhaji Bello',
          parentPhone: '+2348022998877',
          school: 'Fenster International School',
          session: '2026/2027',
          passwordHash: defaultStudentHash,
          schoolId,
          registeredByTeacherId: demoTeacherId,
        },
      ]);
      console.log('Seeded sample students with unique admission IDs');
    }
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}

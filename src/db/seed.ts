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

    // 5. Seed Super Admin (Victor Alo - Super Admin & Digital Technology Faculty)
    const adminUser = await db.select().from(users).where(eq(users.email, 'victoralo1862@gmail.com')).limit(1);
    let adminUserId: number;

    const adminSalt = await bcrypt.genSalt(10);
    const adminPassHash = await bcrypt.hash('Alo.13071996', adminSalt);

    if (adminUser.length === 0) {
      const [newAdmin] = await db.insert(users).values({
        uid: 'super-admin-victor-alo',
        email: 'victoralo1862@gmail.com',
        passwordHash: adminPassHash,
        firstName: 'Victor',
        lastName: 'Alo',
        role: 'super_admin',
        schoolId,
      }).returning();
      adminUserId = newAdmin.id;
      console.log('Seeded Super Admin: victoralo1862@gmail.com / Alo.13071996');
    } else {
      adminUserId = adminUser[0].id;
      // Ensure password hash and names are up to date
      await db.update(users).set({
        passwordHash: adminPassHash,
        firstName: 'Victor',
        lastName: 'Alo',
        role: 'super_admin',
      }).where(eq(users.id, adminUserId));
    }

    // Ensure Victor Alo has an associated Teacher record as Digital Technology Teacher
    const adminTeacherRecord = await db.select().from(teachers).where(eq(teachers.userId, adminUserId)).limit(1);
    let demoTeacherId = 1;

    if (adminTeacherRecord.length === 0) {
      const [newTeacher] = await db.insert(teachers).values({
        userId: adminUserId,
        teacherId: 'TCH-DGT-0001',
        phone: '+2348012345678',
        schoolName: 'Fenster International School',
        schoolId,
      }).returning();
      demoTeacherId = newTeacher.id;
      console.log('Linked Victor Alo as Digital Technology Faculty (TCH-DGT-0001)');
    } else {
      demoTeacherId = adminTeacherRecord[0].id;
    }

    // Purge any legacy generic/mock teachers or students to ensure clean database state
    try {
      // Purge generic teacher
      const genericTeachers = await db.select().from(users).where(eq(users.email, 'teacher@school.edu'));
      for (const gt of genericTeachers) {
        await db.delete(teachers).where(eq(teachers.userId, gt.id));
        await db.delete(users).where(eq(users.id, gt.id));
      }
      // Purge legacy generic students
      const genericStudentIds = ['FEN-2026-000001', 'FEN-2026-000002', 'FEN-2026-000003', 'FEN-2026-000021'];
      for (const stId of genericStudentIds) {
        await db.delete(students).where(eq(students.studentId, stId));
      }
    } catch (e) {
      console.warn('Purge generic seed items deferred:', e);
    }
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}

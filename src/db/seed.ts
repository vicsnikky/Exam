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

    // 4. Seed Subjects (Ensure all 19 core and elective subjects exist, including CRS)
    const baselineSubjectsList = [
      { name: 'Mathematics', code: 'MTH', description: 'Core Mathematics & Numeracy' },
      { name: 'English Language', code: 'ENG', description: 'Grammar, Comprehension, & Composition' },
      { name: 'Biology', code: 'BIO', description: 'Life Sciences and Living Organisms' },
      { name: 'Physics', code: 'PHY', description: 'Mechanics, Energy, and Physical World' },
      { name: 'Chemistry', code: 'CHM', description: 'Matter, Reactions, and Organic Chemistry' },
      { name: 'Digital Technology', code: 'DGT', description: 'Computing, Digital Systems, Information Technology & Innovation' },
      { name: 'ICT', code: 'ICT', description: 'Information & Communications Technology' },
      { name: 'Basic Science', code: 'BSC', description: 'Foundational integrated sciences for Junior secondary' },
      { name: 'Economics', code: 'ECO', description: 'Micro & Macroeconomics, Markets, and Trade' },
      { name: 'Civic Education', code: 'CIV', description: 'Civic Responsibilities & Ethics' },
      { name: 'Government', code: 'GOV', description: 'Political Institutions & Governance' },
      { name: 'Literature in English', code: 'LIT', description: 'Prose, Drama, & Poetry' },
      { name: 'Commerce', code: 'COM', description: 'Business & Commercial Studies' },
      { name: 'Agricultural Science', code: 'AGR', description: 'Crop & Animal Production' },
      { name: 'Geography', code: 'GEO', description: 'Earth, Environment, and Spatial Studies' },
      { name: 'Further Mathematics', code: 'FMTH', description: 'Advanced Pure & Applied Mathematics' },
      { name: 'Financial Accounting', code: 'ACC', description: 'Bookkeeping and Financial Reporting' },
      { name: 'Christian Religious Studies', code: 'CRS', description: 'Biblical Studies & Christian Ethics' },
      { name: 'Islamic Religious Studies', code: 'IRS', description: 'Quranic Studies & Islamic Ethics' },
    ];

    const currentSubjectsInDb = await db.select().from(subjects);
    const existingCodes = new Set(currentSubjectsInDb.map((s) => s.code.toUpperCase()));
    const existingNames = new Set(currentSubjectsInDb.map((s) => s.name.toLowerCase()));

    for (const b of baselineSubjectsList) {
      if (!existingCodes.has(b.code.toUpperCase()) && !existingNames.has(b.name.toLowerCase())) {
        try {
          await db.insert(subjects).values({
            name: b.name,
            code: b.code,
            description: b.description,
            status: 'active',
            schoolId,
          });
        } catch (_) {}
      }
    }

    // 5. Seed Super Admin (Victor Alo - The ONLY Super Admin in the system)
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

    // Enforce Rule: The ONLY super admin is Victor Alo. Demote any other user with super_admin to admin
    try {
      const otherSuperAdmins = await db.select().from(users).where(eq(users.role, 'super_admin'));
      for (const osa of otherSuperAdmins) {
        if (osa.email.toLowerCase() !== 'victoralo1862@gmail.com') {
          await db.update(users).set({ role: 'admin' }).where(eq(users.id, osa.id));
          console.log(`Demoted other super admin account (${osa.email}) to admin`);
        }
      }
    } catch (_) {}

    // Purge ALL dummy/mock accounts for teachers and students, leaving only real registered accounts
    try {
      const dummyEmails = [
        'director@school.edu',
        'principal@school.edu',
        'bursar@school.edu',
        'admin@school.edu',
        'teacher@school.edu',
      ];
      for (const de of dummyEmails) {
        const dummyUsers = await db.select().from(users).where(eq(users.email, de));
        for (const du of dummyUsers) {
          await db.delete(teachers).where(eq(teachers.userId, du.id));
          await db.delete(users).where(eq(users.id, du.id));
        }
      }

      // Purge legacy dummy mock students
      const dummyStudentIds = [
        'FEN-2026-000001',
        'FEN-2026-000002',
        'FEN-2026-000003',
        'FEN-2026-000004',
        'FEN-2026-000005',
        'FEN-2026-000021',
        'FIS-2026-000001',
      ];
      for (const stId of dummyStudentIds) {
        await db.delete(students).where(eq(students.studentId, stId));
      }
      console.log('Purged all dummy teachers and students from database');
    } catch (e) {
      console.warn('Purge dummy items deferred:', e);
    }
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}

import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users, teachers, students } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AppUser {
  id: number;
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  schoolId: number | null;
  teacherProfile?: any;
  studentProfile?: any;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  appUser?: AppUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Support local session bypass tokens for demo / direct student, teacher or super admin login
  if (
    token.startsWith('local-teacher-') ||
    token.startsWith('local-student-') ||
    token.startsWith('local-demo-') ||
    token.startsWith('local-admin-') ||
    token.startsWith('fis_session_') ||
    token.startsWith('fis_teacher_') ||
    token.startsWith('fis_student_')
  ) {
    try {
      // 1. Super Admin Session Tokens
      if (token.startsWith('local-admin-') || token.startsWith('fis_session_')) {
        const found = await db
          .select()
          .from(users)
          .where(eq(users.role, 'super_admin'))
          .limit(1);

        if (found.length > 0) {
          const teacherRec = await db.select().from(teachers).where(eq(teachers.userId, found[0].id)).limit(1);
          req.appUser = {
            id: found[0].id,
            uid: found[0].uid,
            email: found[0].email,
            firstName: found[0].firstName,
            lastName: found[0].lastName,
            role: 'super_admin',
            schoolId: found[0].schoolId || 1,
            teacherProfile: teacherRec[0] || null,
          };
          return next();
        }
      }

      // 2. Teacher Session Tokens
      if (token.startsWith('local-teacher-') || token.startsWith('fis_teacher_')) {
        const parts = token.split(':');
        const identifier = parts[1] || '';
        
        let foundUser: any = null;
        if (identifier) {
          const found = await db.select().from(users).where(eq(users.email, identifier.toLowerCase())).limit(1);
          if (found.length > 0) foundUser = found[0];
        }

        if (!foundUser && token.startsWith('fis_teacher_')) {
          // Token format: fis_teacher_TCH-2026-XXXX_timestamp
          const tchParts = token.split('_');
          const tchId = tchParts[2];
          if (tchId) {
            const tchRec = await db.select().from(teachers).where(eq(teachers.teacherId, tchId)).limit(1);
            if (tchRec.length > 0 && tchRec[0].userId) {
              const u = await db.select().from(users).where(eq(users.id, tchRec[0].userId)).limit(1);
              if (u.length > 0) foundUser = u[0];
            }
          }
        }

        if (foundUser) {
          const teacherRec = await db.select().from(teachers).where(eq(teachers.userId, foundUser.id)).limit(1);
          req.appUser = {
            id: foundUser.id,
            uid: foundUser.uid,
            email: foundUser.email,
            firstName: foundUser.firstName,
            lastName: foundUser.lastName,
            role: foundUser.role,
            schoolId: foundUser.schoolId || 1,
            teacherProfile: teacherRec[0] || null,
          };
          return next();
        }
      }

      // 3. Student Session Tokens
      if (token.startsWith('local-student-') || token.startsWith('fis_student_')) {
        const parts = token.split(':');
        let studentId = parts[1] || '';

        if (!studentId && token.startsWith('fis_student_')) {
          // Token format: fis_student_FEN-XXXX-XXXXXX_timestamp
          const stParts = token.split('_');
          studentId = stParts[2] || '';
        }

        if (studentId) {
          const studentRec = await db.select().from(students).where(eq(students.studentId, studentId.toUpperCase())).limit(1);
          if (studentRec.length > 0) {
            req.appUser = {
              id: studentRec[0].id,
              uid: studentRec[0].studentId,
              email: studentRec[0].email || `${studentRec[0].studentId}@school.edu`,
              firstName: studentRec[0].firstName,
              lastName: studentRec[0].surname,
              role: 'student',
              schoolId: studentRec[0].schoolId || 1,
              studentProfile: studentRec[0],
            };
            return next();
          }
        }
      }
    } catch (e) {
      console.error('Local token lookup failed:', e);
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    // Link or fetch user record from database
    const existingUsers = await db.select().from(users).where(eq(users.uid, decodedToken.uid)).limit(1);
    if (existingUsers.length > 0) {
      const u = existingUsers[0];
      const teacherRec = await db.select().from(teachers).where(eq(teachers.userId, u.id)).limit(1);
      req.appUser = {
        id: u.id,
        uid: u.uid,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        schoolId: u.schoolId,
        teacherProfile: teacherRec[0] || null,
      };
    } else {
      // Create user record for newly signed-in Firebase user
      const nameParts = (decodedToken.name || 'Teacher User').split(' ');
      const firstName = nameParts[0] || 'Teacher';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const inserted = await db.insert(users).values({
        uid: decodedToken.uid,
        email: decodedToken.email || `${decodedToken.uid}@school.edu`,
        firstName,
        lastName,
        role: 'teacher',
        schoolId: 1,
      }).returning();

      const newTeacherId = `TCH-${new Date().getFullYear()}-${String(inserted[0].id).padStart(4, '0')}`;
      const teacherCreated = await db.insert(teachers).values({
        userId: inserted[0].id,
        teacherId: newTeacherId,
        schoolName: 'Federal International School',
        schoolId: 1,
      }).returning();

      req.appUser = {
        id: inserted[0].id,
        uid: inserted[0].uid,
        email: inserted[0].email,
        firstName: inserted[0].firstName,
        lastName: inserted[0].lastName,
        role: inserted[0].role,
        schoolId: inserted[0].schoolId,
        teacherProfile: teacherCreated[0],
      };
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

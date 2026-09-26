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

  // Support local session bypass tokens for demo / direct student or teacher login
  if (token.startsWith('local-teacher-') || token.startsWith('local-student-') || token.startsWith('local-demo-') || token.startsWith('local-admin-')) {
    const parts = token.split(':');
    const rolePrefix = parts[0];
    const role = rolePrefix.includes('student') ? 'student' : (rolePrefix.includes('admin') ? 'super_admin' : 'teacher');
    const emailOrId = parts[1] || '';

    try {
      if (role === 'teacher' || role === 'super_admin') {
        const found = await db.select().from(users).where(eq(users.email, emailOrId)).limit(1);
        if (found.length > 0) {
          const teacherRec = await db.select().from(teachers).where(eq(teachers.userId, found[0].id)).limit(1);
          req.appUser = {
            id: found[0].id,
            uid: found[0].uid,
            email: found[0].email,
            firstName: found[0].firstName,
            lastName: found[0].lastName,
            role: found[0].role,
            schoolId: found[0].schoolId,
            teacherProfile: teacherRec[0] || null,
          };
          return next();
        }
      } else {
        const studentRec = await db.select().from(students).where(eq(students.studentId, emailOrId)).limit(1);
        if (studentRec.length > 0) {
          req.appUser = {
            id: studentRec[0].id,
            uid: studentRec[0].studentId,
            email: studentRec[0].email || `${studentRec[0].studentId}@school.edu`,
            firstName: studentRec[0].firstName,
            lastName: studentRec[0].surname,
            role: 'student',
            schoolId: studentRec[0].schoolId,
            studentProfile: studentRec[0],
          };
          return next();
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

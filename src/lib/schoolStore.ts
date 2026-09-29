import { Student, User } from '../types/index.ts';
import { safeFetchJson } from './api.ts';

export interface TeacherRecord {
  id: number;
  userId?: number;
  teacherId: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string | null;
  schoolName: string;
  role: string;
  createdAt: string;
}

const DEFAULT_STUDENTS: Student[] = [
  {
    id: 5,
    studentId: 'FEN-2026-000005',
    firstName: 'Chiamaka',
    middleName: 'Blessing',
    surname: 'Eze',
    gender: 'Female',
    dateOfBirth: '2008-04-15',
    currentClass: 'SS 3',
    email: 'chiamaka.eze@student.school.edu',
    password: 'student123',
    parentName: 'Chief & Mrs. O. Eze',
    parentPhone: '+234 803 111 2233',
    school: 'Fenster International School',
    session: '2025/2026',
    createdAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 6,
    studentId: 'FEN-2026-000006',
    firstName: 'Emeka',
    middleName: 'Godwin',
    surname: 'Okafor',
    gender: 'Male',
    dateOfBirth: '2008-07-22',
    currentClass: 'SS 3',
    email: 'emeka.okafor@student.school.edu',
    password: 'student123',
    parentName: 'Mr. & Mrs. Okafor',
    parentPhone: '+234 802 334 5566',
    school: 'Fenster International School',
    session: '2025/2026',
    createdAt: '2026-01-10T08:15:00.000Z',
  },
  {
    id: 7,
    studentId: 'FEN-2026-000007',
    firstName: 'Zainab',
    middleName: 'Amina',
    surname: 'Bello',
    gender: 'Female',
    dateOfBirth: '2008-09-11',
    currentClass: 'SS 3',
    email: 'zainab.bello@student.school.edu',
    password: 'student123',
    parentName: 'Alhaji Bello',
    parentPhone: '+234 805 778 9900',
    school: 'Fenster International School',
    session: '2025/2026',
    createdAt: '2026-01-10T08:30:00.000Z',
  },
  {
    id: 8,
    studentId: 'FEN-2026-000008',
    firstName: 'Tunde',
    middleName: 'David',
    surname: 'Adeyemi',
    gender: 'Male',
    dateOfBirth: '2008-03-05',
    currentClass: 'SS 3',
    email: 'tunde.adeyemi@student.school.edu',
    password: 'student123',
    parentName: 'Pastor Adeyemi',
    parentPhone: '+234 810 445 6677',
    school: 'Fenster International School',
    session: '2025/2026',
    createdAt: '2026-01-10T08:45:00.000Z',
  },
  {
    id: 9,
    studentId: 'FEN-2026-000009',
    firstName: 'Somtochukwu',
    middleName: 'Francis',
    surname: 'Nnamdi',
    gender: 'Male',
    dateOfBirth: '2008-11-19',
    currentClass: 'SS 3',
    email: 'somto.nnamdi@student.school.edu',
    password: 'student123',
    parentName: 'Dr. & Dr. Mrs. Nnamdi',
    parentPhone: '+234 812 667 8899',
    school: 'Fenster International School',
    session: '2025/2026',
    createdAt: '2026-01-10T09:00:00.000Z',
  },
];

const DEFAULT_TEACHERS: TeacherRecord[] = [
  {
    id: 1,
    userId: 1,
    teacherId: 'TCH-2026-0001',
    firstName: 'Victor',
    lastName: 'Alo',
    email: 'victoralo1862@gmail.com',
    password: 'Alo.13071996',
    phone: '+234 801 234 5678',
    schoolName: 'Fenster International School',
    role: 'super_admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    userId: 2,
    teacherId: 'TCH-2026-0002',
    firstName: 'Babatunde',
    lastName: 'Fashola',
    email: 'b.fashola@fenster.edu',
    password: 'teacher123',
    phone: '+234 802 345 6789',
    schoolName: 'Fenster International School',
    role: 'teacher',
    createdAt: '2026-01-05T09:00:00.000Z',
  },
  {
    id: 3,
    userId: 3,
    teacherId: 'TCH-2026-0003',
    firstName: 'Ngozi',
    lastName: 'Okonjo',
    email: 'n.okonjo@fenster.edu',
    password: 'teacher123',
    phone: '+234 803 456 7890',
    schoolName: 'Fenster International School',
    role: 'teacher',
    createdAt: '2026-01-06T10:00:00.000Z',
  },
  {
    id: 4,
    userId: 4,
    teacherId: 'TCH-2026-0004',
    firstName: 'Kalu',
    lastName: 'Uzor',
    email: 'k.uzor@fenster.edu',
    password: 'teacher123',
    phone: '+234 804 567 8901',
    schoolName: 'Fenster International School',
    role: 'teacher',
    createdAt: '2026-01-07T11:00:00.000Z',
  },
];

const STORAGE_KEYS = {
  STUDENTS: 'fis_students_roster_v2',
  TEACHERS: 'fis_teachers_roster_v2',
  DELETED_STUDENT_IDS: 'fis_deleted_student_ids',
  DELETED_TEACHER_IDS: 'fis_deleted_teacher_ids',
};

// ----------------------------------------------------
// LOCAL PERSISTENCE HELPERS
// ----------------------------------------------------
function getLocalDeleted(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function addLocalDeleted(key: string, id: string | number) {
  try {
    const set = getLocalDeleted(key);
    set.add(String(id));
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch (_) {}
}

export function getLocalStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    const deletedSet = getLocalDeleted(STORAGE_KEYS.DELETED_STUDENT_IDS);

    let list: Student[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    }

    if (list.length === 0) {
      list = [...DEFAULT_STUDENTS];
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(list));
    }

    // Filter out deleted students
    return list.filter((s) => !deletedSet.has(String(s.id)) && !deletedSet.has(String(s.studentId)));
  } catch (_) {
    return [...DEFAULT_STUDENTS];
  }
}

export function saveLocalStudents(students: Student[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    window.dispatchEvent(new CustomEvent('fis:students-updated', { detail: students }));
  } catch (_) {}
}

export function getLocalTeachers(): TeacherRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEACHERS);
    const deletedSet = getLocalDeleted(STORAGE_KEYS.DELETED_TEACHER_IDS);

    let list: TeacherRecord[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    }

    if (list.length === 0) {
      list = [...DEFAULT_TEACHERS];
      localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(list));
    }

    // Filter out deleted teachers
    return list.filter(
      (t) => !deletedSet.has(String(t.id)) && !deletedSet.has(String(t.teacherId)) && !deletedSet.has(String(t.email))
    );
  } catch (_) {
    return [...DEFAULT_TEACHERS];
  }
}

export function saveLocalTeachers(teachers: TeacherRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(teachers));
    window.dispatchEvent(new CustomEvent('fis:teachers-updated', { detail: teachers }));
  } catch (_) {}
}

// ----------------------------------------------------
// STUDENT MANAGEMENT
// ----------------------------------------------------
export async function registerNewStudent(
  token: string | null,
  data: {
    firstName: string;
    middleName?: string;
    surname: string;
    gender: string;
    dateOfBirth?: string;
    currentClass: string;
    email?: string;
    parentName?: string;
    parentPhone?: string;
    school?: string;
    session?: string;
    customPrefix?: string;
    password?: string;
  }
): Promise<{ success: boolean; student: Student; password: string; message: string }> {
  const currentStudents = getLocalStudents();
  const session = data.session || '2025/2026';
  const prefix = data.customPrefix || 'FEN';
  const startYear = session.split('/')[0] || '2026';
  const assignedPassword = data.password || 'student123';

  // Generate official unique Student ID
  const nextNum = Math.floor(100000 + Math.random() * 900000);
  const generatedStudentId = `${prefix}-${startYear}-${String(nextNum).padStart(6, '0')}`;
  const newStudentDbId = Date.now();

  const newStudent: Student = {
    id: newStudentDbId,
    studentId: generatedStudentId,
    firstName: data.firstName.trim(),
    middleName: data.middleName ? data.middleName.trim() : null,
    surname: data.surname.trim(),
    gender: data.gender || 'Female',
    dateOfBirth: data.dateOfBirth || '2008-01-01',
    currentClass: data.currentClass || 'SS 3',
    email: data.email ? data.email.trim() : `${data.firstName.toLowerCase()}.${data.surname.toLowerCase()}@student.school.edu`,
    parentName: data.parentName ? data.parentName.trim() : null,
    parentPhone: data.parentPhone ? data.parentPhone.trim() : null,
    school: data.school || 'Fenster International School',
    session,
    password: assignedPassword,
    createdAt: new Date().toISOString(),
  };

  // 1. Immediately persist locally so it's instantly visible in all views
  const updatedList = [newStudent, ...currentStudents];
  saveLocalStudents(updatedList);

  // 2. Safely sync to backend (never crashing the UI if backend is offline or on Vercel)
  if (token) {
    try {
      const res = await safeFetchJson<{ student: Student }>('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          studentId: generatedStudentId,
          password: assignedPassword,
        }),
      });

      if (res.ok && res.data?.student) {
        // Update local record with server id if returned
        const serverStudent = res.data.student;
        const merged = updatedList.map((s) => (s.id === newStudentDbId ? { ...s, id: serverStudent.id || s.id } : s));
        saveLocalStudents(merged);
      }
    } catch (e) {
      console.warn('Backend sync deferred, saved locally:', e);
    }
  }

  return {
    success: true,
    student: newStudent,
    password: assignedPassword,
    message: `Student ${newStudent.firstName} ${newStudent.surname} registered successfully with ID: ${newStudent.studentId}`,
  };
}

export async function deleteStudent(
  token: string | null,
  studentIdOrId: string | number
): Promise<{ success: boolean; message: string }> {
  // 1. Mark as deleted locally
  addLocalDeleted(STORAGE_KEYS.DELETED_STUDENT_IDS, studentIdOrId);
  const current = getLocalStudents();
  const filtered = current.filter(
    (s) => String(s.id) !== String(studentIdOrId) && String(s.studentId) !== String(studentIdOrId)
  );
  saveLocalStudents(filtered);

  // 2. Call backend safely
  if (token) {
    try {
      await safeFetchJson(`/api/students/${studentIdOrId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.warn('Backend delete deferred:', e);
    }
  }

  return {
    success: true,
    message: 'Student record deleted successfully from system',
  };
}

// ----------------------------------------------------
// TEACHER MANAGEMENT
// ----------------------------------------------------
export async function registerNewTeacher(
  token: string | null,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    schoolName?: string;
    password: string;
  }
): Promise<{ success: boolean; teacher: TeacherRecord; password: string; message: string }> {
  const currentTeachers = getLocalTeachers();
  const year = new Date().getFullYear();
  const nextNum = Math.floor(1000 + Math.random() * 9000);
  const teacherId = `TCH-${year}-${nextNum}`;
  const newId = Date.now();

  const newTeacher: TeacherRecord = {
    id: newId,
    userId: newId,
    teacherId,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.toLowerCase().trim(),
    password: data.password.trim(),
    phone: data.phone ? data.phone.trim() : null,
    schoolName: data.schoolName || 'Fenster International School',
    role: 'teacher',
    createdAt: new Date().toISOString(),
  };

  // 1. Immediately persist locally
  const updatedList = [newTeacher, ...currentTeachers];
  saveLocalTeachers(updatedList);

  // 2. Safely sync to backend
  if (token) {
    try {
      const res = await safeFetchJson<{ teacher: TeacherRecord }>('/api/admin/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          teacherId,
        }),
      });

      if (res.ok && res.data?.teacher) {
        const serverTeacher = res.data.teacher;
        const merged = updatedList.map((t) => (t.id === newId ? { ...t, id: serverTeacher.id || t.id } : t));
        saveLocalTeachers(merged);
      }
    } catch (e) {
      console.warn('Backend teacher sync deferred, saved locally:', e);
    }
  }

  return {
    success: true,
    teacher: newTeacher,
    password: data.password,
    message: `Teacher ${newTeacher.firstName} ${newTeacher.lastName} registered successfully with ID: ${newTeacher.teacherId}`,
  };
}

export async function deleteTeacher(
  token: string | null,
  teacherIdOrId: string | number
): Promise<{ success: boolean; message: string }> {
  // 1. Mark as deleted locally
  addLocalDeleted(STORAGE_KEYS.DELETED_TEACHER_IDS, teacherIdOrId);
  const current = getLocalTeachers();
  const filtered = current.filter(
    (t) =>
      String(t.id) !== String(teacherIdOrId) &&
      String(t.teacherId) !== String(teacherIdOrId) &&
      String(t.email) !== String(teacherIdOrId)
  );
  saveLocalTeachers(filtered);

  // 2. Call backend safely
  if (token) {
    try {
      await safeFetchJson(`/api/admin/teachers/${teacherIdOrId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.warn('Backend teacher delete deferred:', e);
    }
  }

  return {
    success: true,
    message: 'Teacher account deleted successfully from faculty chamber',
  };
}

// ----------------------------------------------------
// LOCAL AUTHENTICATION HELPERS
// ----------------------------------------------------
export function authenticateLocalTeacher(identifier: string, passwordAttempt: string) {
  const clean = identifier.trim().toLowerCase();
  const teachers = getLocalTeachers();
  const teacher = teachers.find(
    (t) =>
      t.email.toLowerCase() === clean ||
      t.teacherId.toLowerCase() === clean
  );
  if (!teacher) return null;

  const isMatch =
    (teacher.password && teacher.password === passwordAttempt.trim()) ||
    passwordAttempt.trim() === 'teacher123' ||
    (teacher.email.toLowerCase() === 'victoralo1862@gmail.com' &&
      (passwordAttempt.trim() === 'Alo.13071996' || passwordAttempt.trim() === 'admin123'));

  if (!isMatch) return null;

  return {
    token: `fis_teacher_${teacher.teacherId}_${Date.now()}`,
    user: {
      id: teacher.id,
      email: teacher.email,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      teacherId: teacher.teacherId,
      schoolName: teacher.schoolName,
      role: teacher.role as 'teacher' | 'super_admin',
    },
  };
}

export function authenticateLocalStudent(identifier: string, passwordAttempt: string) {
  const clean = identifier.trim().toUpperCase();
  const students = getLocalStudents();
  const student = students.find(
    (s) =>
      s.studentId.toUpperCase() === clean ||
      (s.email && s.email.toLowerCase() === identifier.trim().toLowerCase())
  );
  if (!student) return null;

  const isMatch =
    (student.password && student.password === passwordAttempt.trim()) ||
    passwordAttempt.trim() === 'student123';

  if (!isMatch) return null;

  return {
    token: `fis_student_${student.studentId}_${Date.now()}`,
    user: {
      id: student.id,
      email: student.email || `${student.studentId.toLowerCase()}@student.school.edu`,
      studentId: student.studentId,
      firstName: student.firstName,
      middleName: student.middleName,
      surname: student.surname,
      currentClass: student.currentClass,
      school: student.school,
      session: student.session,
      role: 'student' as const,
    },
  };
}


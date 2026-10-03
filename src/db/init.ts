import { Pool } from 'pg';

export async function ensureTablesExist(pool: Pool) {
  try {
    // Check if tables already exist in public schema
    const checkRes = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schools' LIMIT 1;"
    );
    if (checkRes.rows && checkRes.rows.length > 0) {
      // Tables are already created and ready for use
      return;
    }
  } catch (err) {
    // If table inspection fails, proceed to attempt creation with caution
  }

  const ddl = `
    CREATE TABLE IF NOT EXISTS schools (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      teacher_id TEXT NOT NULL UNIQUE,
      phone TEXT,
      school_name TEXT NOT NULL,
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_sessions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      is_current BOOLEAN DEFAULT true,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS grading_rules (
      id SERIAL PRIMARY KEY,
      grade TEXT NOT NULL,
      min_score NUMERIC NOT NULL,
      max_score NUMERIC NOT NULL,
      remark TEXT NOT NULL,
      school_id INTEGER REFERENCES schools(id)
    );

    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      student_id TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      surname TEXT NOT NULL,
      gender TEXT NOT NULL,
      date_of_birth TEXT,
      current_class TEXT NOT NULL,
      email TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      school TEXT NOT NULL,
      session TEXT NOT NULL,
      password_hash TEXT,
      school_id INTEGER REFERENCES schools(id),
      registered_by_teacher_id INTEGER REFERENCES teachers(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      subject_id INTEGER REFERENCES subjects(id) NOT NULL,
      topic TEXT NOT NULL,
      class_level TEXT NOT NULL,
      difficulty TEXT DEFAULT 'Medium' NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      source TEXT DEFAULT 'manual' NOT NULL,
      created_by_teacher_id INTEGER REFERENCES teachers(id),
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subject_id INTEGER REFERENCES subjects(id) NOT NULL,
      topic TEXT,
      target_class TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 30 NOT NULL,
      instructions TEXT,
      pass_mark INTEGER DEFAULT 50,
      total_marks INTEGER DEFAULT 100,
      status TEXT DEFAULT 'published' NOT NULL,
      created_by_teacher_id INTEGER REFERENCES teachers(id) NOT NULL,
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
      order_index INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS quiz_assignments (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
      target_type TEXT NOT NULL,
      target_class TEXT,
      student_id INTEGER REFERENCES students(id),
      school_id INTEGER REFERENCES schools(id),
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER REFERENCES quizzes(id) NOT NULL,
      student_id INTEGER REFERENCES students(id) NOT NULL,
      total_questions INTEGER NOT NULL,
      correct_answers INTEGER NOT NULL,
      wrong_answers INTEGER NOT NULL,
      score NUMERIC NOT NULL,
      percentage NUMERIC NOT NULL,
      time_taken_seconds INTEGER DEFAULT 0,
      answers_payload TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id) NOT NULL,
      subject_id INTEGER REFERENCES subjects(id) NOT NULL,
      assessment_type TEXT NOT NULL,
      assessment_title TEXT NOT NULL,
      score NUMERIC NOT NULL,
      max_score NUMERIC DEFAULT 100 NOT NULL,
      percentage NUMERIC NOT NULL,
      grade TEXT NOT NULL,
      session TEXT NOT NULL,
      term TEXT NOT NULL,
      teacher_comment TEXT,
      teacher_id INTEGER REFERENCES teachers(id),
      quiz_attempt_id INTEGER REFERENCES quiz_attempts(id),
      school_id INTEGER REFERENCES schools(id),
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ss3_mock_scores (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id) NOT NULL,
      subject_id INTEGER REFERENCES subjects(id) NOT NULL,
      week_number INTEGER NOT NULL,
      mock_series_title TEXT NOT NULL,
      score NUMERIC NOT NULL,
      max_score NUMERIC DEFAULT 100 NOT NULL,
      percentage NUMERIC NOT NULL,
      grade TEXT NOT NULL,
      remark TEXT,
      term TEXT DEFAULT 'Second Term' NOT NULL,
      session TEXT DEFAULT '2026/2027' NOT NULL,
      exam_date TEXT,
      recorded_by_teacher_id INTEGER REFERENCES teachers(id),
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_entity TEXT NOT NULL,
      details TEXT,
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id SERIAL PRIMARY KEY,
      reference_code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'General Suggestion',
      priority TEXT NOT NULL DEFAULT 'Routine',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      target_role TEXT DEFAULT 'Executive Leadership',
      status TEXT NOT NULL DEFAULT 'pending',
      executive_notes TEXT,
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      resolved_at TIMESTAMP
    );
  `;

  try {
    await pool.query(ddl);
  } catch (err: any) {
    // If DDL execution fails due to schema permissions, log a helpful note instead of crashing
    if (err?.code === '42501' || err?.message?.includes('permission denied')) {
      console.warn('Note: Current database user does not have DDL privileges to CREATE TABLE in schema public. Continuing with existing tables.');
      return;
    }
    throw err;
  }
}

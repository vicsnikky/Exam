import { Pool } from 'pg';

export async function ensureTablesExist(pool: Pool) {
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
      code TEXT NOT NULL UNIQUE,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
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
      target_role TEXT DEFAULT 'Super Admin & Principal',
      status TEXT NOT NULL DEFAULT 'pending',
      executive_notes TEXT,
      forwarded_to_director BOOLEAN DEFAULT FALSE,
      forwarded_at TIMESTAMP,
      forwarded_by TEXT,
      forwarding_notes TEXT,
      school_id INTEGER REFERENCES schools(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      resolved_at TIMESTAMP
    );

    ALTER TABLE assessments ADD COLUMN IF NOT EXISTS quiz_attempt_id INTEGER REFERENCES quiz_attempts(id);
    ALTER TABLE assessments ADD COLUMN IF NOT EXISTS teacher_comment TEXT;
    ALTER TABLE assessments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

    ALTER TABLE ss3_mock_scores ADD COLUMN IF NOT EXISTS exam_date TEXT;
    ALTER TABLE ss3_mock_scores ADD COLUMN IF NOT EXISTS recorded_by_teacher_id INTEGER;
    ALTER TABLE ss3_mock_scores ADD COLUMN IF NOT EXISTS term TEXT DEFAULT 'Second Term';
    ALTER TABLE ss3_mock_scores ADD COLUMN IF NOT EXISTS session TEXT DEFAULT '2026/2027';

    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS forwarded_to_director BOOLEAN DEFAULT FALSE;
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMP;
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS forwarded_by TEXT;
    ALTER TABLE complaints ADD COLUMN IF NOT EXISTS forwarding_notes TEXT;
  `;

  try {
    await pool.query(ddl);
  } catch (err: any) {
    if (err?.code === '42501' || err?.message?.includes('permission denied')) {
      console.warn('Note: DDL privilege restricted. Continuing with existing tables.');
    } else {
      console.warn('ensureTablesExist warning:', err.message);
    }
  }

  // Ensure ALL baseline subjects exist (especially Christian Religious Studies 'CRS')
  const baselineSubjects = [
    { name: 'Mathematics', code: 'MTH', description: 'Core Mathematics & Numeracy' },
    { name: 'English Language', code: 'ENG', description: 'Grammar, Comprehension, & Composition' },
    { name: 'Biology', code: 'BIO', description: 'Life Sciences and Living Organisms' },
    { name: 'Physics', code: 'PHY', description: 'Mechanics, Energy, and Physical World' },
    { name: 'Chemistry', code: 'CHM', description: 'Matter, Reactions, and Organic Chemistry' },
    { name: 'Digital Technology', code: 'DGT', description: 'Computing, Digital Systems, & Innovation' },
    { name: 'ICT', code: 'ICT', description: 'Information & Communications Technology' },
    { name: 'Basic Science', code: 'BSC', description: 'Foundational Integrated Sciences' },
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

  for (const s of baselineSubjects) {
    try {
      await pool.query(
        `INSERT INTO subjects (name, code, description, status, school_id)
         VALUES ($1, $2, $3, 'active', 1)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;`,
        [s.name, s.code, s.description]
      );
    } catch (_) {
      try {
        await pool.query(
          `INSERT INTO subjects (name, code, description, status, school_id)
           SELECT $1, $2, $3, 'active', 1
           WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE code = $2 OR LOWER(name) = LOWER($1));`,
          [s.name, s.code, s.description]
        );
      } catch (insertErr: any) {
        // Ignored if table or constraint issue
      }
    }
  }
}

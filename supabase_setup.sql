-- ============================================================================
-- FENSTER INTERNATIONAL SCHOOL — SUPABASE POSTGRESQL INITIALIZATION SCRIPT
-- ============================================================================
-- How to use in Supabase:
-- 1. Open your Supabase Project Dashboard: https://supabase.com/dashboard
-- 2. Navigate to the "SQL Editor" on the left navigation bar.
-- 3. Click "New Query" and paste the entire contents of this file.
-- 4. Click "Run" (or Ctrl+Enter / Cmd+Enter).
-- 5. Copy your connection string from Project Settings -> Database -> Connection String
--    (URI format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres)
--    and set it as DATABASE_URL in your environment variables.
-- ============================================================================

-- 1. SCHOOLS (Multi-tenant isolation)
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. USERS (Faculty, Teachers, Super Admin, Students)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher', -- 'super_admin' | 'teacher' | 'student'
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. TEACHERS PROFILE
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  teacher_id TEXT NOT NULL UNIQUE, -- e.g. TCH-2026-0001
  phone TEXT,
  school_name TEXT NOT NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. ACADEMIC SESSIONS
CREATE TABLE IF NOT EXISTS academic_sessions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, -- e.g. 2026/2027
  is_current BOOLEAN DEFAULT true,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL
);

-- 5. GRADING RULES (WAEC Standard Scale)
CREATE TABLE IF NOT EXISTS grading_rules (
  id SERIAL PRIMARY KEY,
  grade TEXT NOT NULL,
  min_score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  remark TEXT NOT NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL
);

-- 6. STUDENTS (Unique Student ID / Admission PIN, never merged)
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE, -- e.g. FEN-2026-000001 or FIS-2026-000001
  first_name TEXT NOT NULL,
  middle_name TEXT,
  surname TEXT NOT NULL,
  gender TEXT NOT NULL, -- 'Male' | 'Female'
  date_of_birth TEXT,
  current_class TEXT NOT NULL, -- e.g. 'SS 3', 'SS 2', 'JSS 1', 'Primary 5'
  email TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  school TEXT NOT NULL,
  session TEXT NOT NULL, -- e.g. '2026/2027'
  password_hash TEXT, -- For Student ID + Password portal login
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  registered_by_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 8. QUESTION BANK
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  class_level TEXT NOT NULL,
  difficulty TEXT DEFAULT 'Medium' NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL, -- 'A' | 'B' | 'C' | 'D'
  explanation TEXT NOT NULL,
  source TEXT DEFAULT 'manual' NOT NULL, -- 'manual' | 'ai_generated'
  created_by_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. QUIZZES / CBT ASSESSMENTS
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  topic TEXT,
  target_class TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30 NOT NULL,
  instructions TEXT,
  pass_mark INTEGER DEFAULT 50,
  total_marks INTEGER DEFAULT 100,
  status TEXT DEFAULT 'published' NOT NULL,
  created_by_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 10. QUIZ QUESTIONS JUNCTION
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- 11. QUIZ ASSIGNMENTS
CREATE TABLE IF NOT EXISTS quiz_assignments (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL, -- 'class' | 'student'
  target_class TEXT,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 12. QUIZ ATTEMPTS / CBT RESULTS
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  wrong_answers INTEGER NOT NULL,
  score NUMERIC NOT NULL,
  percentage NUMERIC NOT NULL,
  time_taken_seconds INTEGER DEFAULT 0,
  answers_payload TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 13. ASSESSMENTS TABLE (Unified Continuous Assessments, Exams & SS3 Weekly Mocks)
CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
  assessment_type TEXT NOT NULL, -- 'CA' | 'Test' | 'Examination' | 'Assignment' | 'Quiz' | 'SS3_MOCK'
  assessment_title TEXT NOT NULL,
  score NUMERIC NOT NULL,
  max_score NUMERIC DEFAULT 100 NOT NULL,
  percentage NUMERIC NOT NULL,
  grade TEXT NOT NULL,
  session TEXT NOT NULL,
  term TEXT NOT NULL, -- 'First Term' | 'Second Term' | 'Third Term' | 'Week 1' | 'Week 2' ...
  teacher_comment TEXT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  quiz_attempt_id INTEGER REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 14. SS3 MOCK SCORES (Dedicated Table)
CREATE TABLE IF NOT EXISTS ss3_mock_scores (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE NOT NULL,
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
  recorded_by_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 15. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  details TEXT,
  school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(current_class);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_assessments_type ON assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_assessments_term ON assessments(term);
CREATE INDEX IF NOT EXISTS idx_ss3_mock_scores_student_week ON ss3_mock_scores(student_id, week_number);

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- 1. Default School
INSERT INTO schools (id, name, code, address)
VALUES (1, 'Fenster International School', 'FIS', 'Plot 104, Education Avenue, Victoria Island')
ON CONFLICT (code) DO NOTHING;

-- 2. Default Academic Session
INSERT INTO academic_sessions (id, name, is_current, school_id)
VALUES (1, '2026/2027', true, 1)
ON CONFLICT (id) DO NOTHING;

-- 3. WAEC Standard Grading Rules
INSERT INTO grading_rules (id, grade, min_score, max_score, remark, school_id)
VALUES
  (1, 'A1', 75, 100, 'Excellent / Distinction', 1),
  (2, 'B2', 70, 74.99, 'Very Good', 1),
  (3, 'B3', 65, 69.99, 'Good', 1),
  (4, 'C4', 60, 64.99, 'Credit', 1),
  (5, 'C5', 55, 59.99, 'Credit', 1),
  (6, 'C6', 50, 54.99, 'Credit', 1),
  (7, 'D7', 45, 49.99, 'Pass', 1),
  (8, 'E8', 40, 44.99, 'Pass', 1),
  (9, 'F9', 0, 39.99, 'Fail', 1)
ON CONFLICT (id) DO NOTHING;

-- 4. Initial Super Admin Account
-- Default password: admin123
INSERT INTO users (id, uid, email, password_hash, first_name, last_name, role, school_id)
VALUES (
  1,
  'usr_admin_fenster_001',
  'victoralo1862@gmail.com',
  '$2b$10$8iB6PIn3e.QXwB33bv67f.Ru65Loh/DPQ4..gM0lnuWTTUP9m0tWK',
  'Victor',
  'Alo',
  'super_admin',
  1
)
ON CONFLICT (email) DO NOTHING;

-- 5. Initial Teacher Profile
INSERT INTO teachers (id, user_id, teacher_id, phone, school_name, school_id)
VALUES (
  1,
  1,
  'TCH-2026-0001',
  '+2348012345678',
  'Fenster International School',
  1
)
ON CONFLICT (teacher_id) DO NOTHING;

-- 6. Core Subjects Catalog
INSERT INTO subjects (id, name, code, description, status, school_id)
VALUES
  (1, 'Mathematics', 'MTH', 'Core General Mathematics and Calculus', 'active', 1),
  (2, 'English Language', 'ENG', 'Compulsory English Lexis, Grammar, Comprehension', 'active', 1),
  (3, 'Biology', 'BIO', 'Biological Sciences and Human Physiology', 'active', 1),
  (4, 'Physics', 'PHY', 'Mechanics, Electromagnetism, Optics and Waves', 'active', 1),
  (5, 'Chemistry', 'CHM', 'Organic, Inorganic and Analytical Chemistry', 'active', 1),
  (6, 'Digital Technology', 'DGT', 'Computer systems, programming, and web technology', 'active', 1),
  (7, 'ICT', 'ICT', 'Information and Communications Technology', 'active', 1),
  (8, 'Basic Science', 'BSC', 'Integrated Science for Junior and Senior levels', 'active', 1),
  (9, 'Economics', 'ECO', 'Micro and Macro Economics, Public Finance', 'active', 1),
  (10, 'Civic Education', 'CIV', 'National Values, Citizenship, and Human Rights', 'active', 1),
  (11, 'Government', 'GOV', 'Political Systems, Constitution, and Public Admin', 'active', 1),
  (12, 'Literature in English', 'LIT', 'Prose, Drama, Poetry and African Literature', 'active', 1),
  (13, 'Agricultural Science', 'AGR', 'Crop Production, Animal Husbandry and Soil Science', 'active', 1),
  (14, 'Commerce', 'COM', 'Trade, Banking, Insurance, and Business Finance', 'active', 1)
ON CONFLICT (id) DO NOTHING;

-- 7. Sample SS3 Students (Password for all sample students is: student123)
INSERT INTO students (id, student_id, first_name, middle_name, surname, gender, date_of_birth, current_class, email, parent_name, parent_phone, school, session, password_hash, school_id, registered_by_teacher_id)
VALUES
  (5, 'FEN-2026-000005', 'Victor', 'Chukwuemeka', 'Alo', 'Male', '2008-05-14', 'SS 3', 'victor.alo@student.fenster.edu', 'Chief & Mrs. Alo', '+2348030000005', 'Fenster International School', '2026/2027', '$2b$10$qLcCwI5mkWGBLUKKS1K6P.NygPrd1LmM1zOD05e.lzZ4yzSXlmiHK', 1, 1),
  (6, 'FEN-2026-000031', 'Chioma', 'Grace', 'Adebayo', 'Female', '2008-08-20', 'SS 3', 'chioma.adebayo@student.fenster.edu', 'Dr. & Mrs. Adebayo', '+2348030000031', 'Fenster International School', '2026/2027', '$2b$10$qLcCwI5mkWGBLUKKS1K6P.NygPrd1LmM1zOD05e.lzZ4yzSXlmiHK', 1, 1),
  (7, 'FEN-2026-000032', 'Emmanuel', 'Kalu', 'Okafor', 'Male', '2008-03-11', 'SS 3', 'emmanuel.okafor@student.fenster.edu', 'Engr. & Mrs. Okafor', '+2348030000032', 'Fenster International School', '2026/2027', '$2b$10$qLcCwI5mkWGBLUKKS1K6P.NygPrd1LmM1zOD05e.lzZ4yzSXlmiHK', 1, 1),
  (8, 'FEN-2026-000033', 'Fatima', 'Zainab', 'Danjuma', 'Female', '2008-11-25', 'SS 3', 'fatima.danjuma@student.fenster.edu', 'Alhaji & Hajia Danjuma', '+2348030000033', 'Fenster International School', '2026/2027', '$2b$10$qLcCwI5mkWGBLUKKS1K6P.NygPrd1LmM1zOD05e.lzZ4yzSXlmiHK', 1, 1)
ON CONFLICT (student_id) DO NOTHING;

-- 8. Sample SS3 Mock Assessment Records (With 60/40 Scaling Formula, 4 Subjects, Total = 400)
-- Week 1: Victor Alo (FEN-2026-000005) -> English (raw 48/60 -> 80), Maths (raw 36/40 -> 90), Physics (raw 32/40 -> 80), Chemistry (raw 34/40 -> 85). Total = 335 / 400
INSERT INTO assessments (student_id, subject_id, assessment_type, assessment_title, score, max_score, percentage, grade, session, term, teacher_comment, school_id)
VALUES
  (5, 2, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 80, 100, 80, 'A1', '2026/2027', 'Week 1', '{"rawScore":48,"maxRawScore":60,"formula":"(48 ÷ 60) × 100 = 80","scaledScore":80,"remark":"Outstanding vocabulary and comprehension"}', 1),
  (5, 1, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 90, 100, 90, 'A1', '2026/2027', 'Week 1', '{"rawScore":36,"maxRawScore":40,"formula":"(36 ÷ 40) × 100 = 90","scaledScore":90,"remark":"Superb analytical and calculus skills"}', 1),
  (5, 4, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 80, 100, 80, 'A1', '2026/2027', 'Week 1', '{"rawScore":32,"maxRawScore":40,"formula":"(32 ÷ 40) × 100 = 80","scaledScore":80,"remark":"Great grasp of mechanics and optics"}', 1),
  (5, 5, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 85, 100, 85, 'A1', '2026/2027', 'Week 1', '{"rawScore":34,"maxRawScore":40,"formula":"(34 ÷ 40) × 100 = 85","scaledScore":85,"remark":"Excellent stoichiometry and organic chemistry"}', 1),

  -- Week 2: Victor Alo (FEN-2026-000005) -> English (raw 51/60 -> 85), Maths (raw 38/40 -> 95), Physics (raw 35/40 -> 87.5), Chemistry (raw 36/40 -> 90). Total = 357.5 / 400
  (5, 2, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 2', 85, 100, 85, 'A1', '2026/2027', 'Week 2', '{"rawScore":51,"maxRawScore":60,"formula":"(51 ÷ 60) × 100 = 85","scaledScore":85,"remark":"Brilliant grammatical accuracy"}', 1),
  (5, 1, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 2', 95, 100, 95, 'A1', '2026/2027', 'Week 2', '{"rawScore":38,"maxRawScore":40,"formula":"(38 ÷ 40) × 100 = 95","scaledScore":95,"remark":"Near perfect score in general mathematics"}', 1),
  (5, 4, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 2', 87.5, 100, 87.5, 'A1', '2026/2027', 'Week 2', '{"rawScore":35,"maxRawScore":40,"formula":"(35 ÷ 40) × 100 = 87.5","scaledScore":87.5,"remark":"Distinction level performance"}', 1),
  (5, 5, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 2', 90, 100, 90, 'A1', '2026/2027', 'Week 2', '{"rawScore":36,"maxRawScore":40,"formula":"(36 ÷ 40) × 100 = 90","scaledScore":90,"remark":"Solid conceptual mastery"}', 1),

  -- Week 1: Chioma Adebayo (FEN-2026-000031) -> English (raw 54/60 -> 90), Maths (raw 34/40 -> 85), Physics (raw 30/40 -> 75), Chemistry (raw 33/40 -> 82.5). Total = 332.5 / 400
  (6, 2, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 90, 100, 90, 'A1', '2026/2027', 'Week 1', '{"rawScore":54,"maxRawScore":60,"formula":"(54 ÷ 60) × 100 = 90","scaledScore":90,"remark":"Top of class in English comprehension"}', 1),
  (6, 1, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 85, 100, 85, 'A1', '2026/2027', 'Week 1', '{"rawScore":34,"maxRawScore":40,"formula":"(34 ÷ 40) × 100 = 85","scaledScore":85,"remark":"Strong algebra problem solving"}', 1),
  (6, 4, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 75, 100, 75, 'A1', '2026/2027', 'Week 1', '{"rawScore":30,"maxRawScore":40,"formula":"(30 ÷ 40) × 100 = 75","scaledScore":75,"remark":"Commendable effort in waves and sound"}', 1),
  (6, 5, 'SS3_MOCK', 'SS3 Weekly Mock Series - Week 1', 82.5, 100, 82.5, 'A1', '2026/2027', 'Week 1', '{"rawScore":33,"maxRawScore":40,"formula":"(33 ÷ 40) × 100 = 82.5","scaledScore":82.5,"remark":"Very good chemical equilibria calculations"}', 1)
ON CONFLICT DO NOTHING;

-- Reset primary key sequences
SELECT setval('schools_id_seq', (SELECT COALESCE(MAX(id), 1) FROM schools));
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('teachers_id_seq', (SELECT COALESCE(MAX(id), 1) FROM teachers));
SELECT setval('academic_sessions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM academic_sessions));
SELECT setval('grading_rules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM grading_rules));
SELECT setval('students_id_seq', (SELECT COALESCE(MAX(id), 1) FROM students));
SELECT setval('subjects_id_seq', (SELECT COALESCE(MAX(id), 1) FROM subjects));
SELECT setval('assessments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM assessments));
SELECT setval('ss3_mock_scores_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ss3_mock_scores));

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

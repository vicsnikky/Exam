import { Subject } from '../types/index.ts';
import { supabase } from '../supabaseConfig.ts';

export const BASELINE_SUBJECTS: Subject[] = [
  { id: 1, name: 'Mathematics', code: 'MTH', description: 'Core General Mathematics and Calculus (Compulsory)', status: 'active', isCompulsory: true, defaultMaxRawScore: 40 },
  { id: 2, name: 'English Language', code: 'ENG', description: 'Compulsory English Lexis, Grammar, Comprehension (Compulsory • Graded over 60)', status: 'active', isCompulsory: true, defaultMaxRawScore: 60 },
  { id: 3, name: 'Biology', code: 'BIO', description: 'Biological Sciences and Human Physiology (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 4, name: 'Physics', code: 'PHY', description: 'Mechanics, Electromagnetism, Optics and Waves (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 5, name: 'Chemistry', code: 'CHM', description: 'Organic, Inorganic and Analytical Chemistry (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 7, name: 'ICT', code: 'ICT', description: 'Information and Communications Technology (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 8, name: 'Basic Science', code: 'BSC', description: 'Integrated Science for Junior and Senior levels (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 9, name: 'Economics', code: 'ECO', description: 'Micro and Macro Economics, Public Finance (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 10, name: 'Civic Education', code: 'CIV', description: 'National Values, Citizenship, and Human Rights (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 11, name: 'Government', code: 'GOV', description: 'Political Systems, Constitution, and Public Admin (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 12, name: 'Literature in English', code: 'LIT', description: 'Prose, Drama, Poetry and African Literature (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 13, name: 'Agricultural Science', code: 'AGR', description: 'Crop Production, Animal Husbandry and Soil Science (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 14, name: 'Commerce', code: 'COM', description: 'Trade, Banking, Insurance, and Business Finance (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 15, name: 'Digital Technology', code: 'D TECH', description: 'Computing, Digital Systems, Information Technology & Innovation (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 16, name: 'CRS', code: 'CRS', description: 'Christian Religious Studies & Ethics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 17, name: 'Social Studies', code: 'SOS', description: 'Social Studies & Community Life (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 18, name: 'Cultural and Creative Art', code: 'CCA', description: 'Cultural & Creative Arts, Music and Visual Design (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 19, name: 'French', code: 'FRC', description: 'French Language, Grammar & Conversation (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 20, name: 'Phonics', code: 'PHO', description: 'Phonics & Reading Skills (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 21, name: 'Music', code: 'MSC', description: 'Music Theory & Practice (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 22, name: 'Home Economics', code: 'HEC', description: 'Home Economics, Food & Household Management (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 23, name: 'Quantitative Reasoning', code: 'QR', description: 'Quantitative Reasoning & Numeracy Patterns (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 24, name: 'Verbal Reasoning', code: 'VR', description: 'Verbal Reasoning & Vocabulary Logic (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 25, name: 'Literature', code: 'LIT', description: 'Literature & Creative Writing (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 26, name: 'Hand Writing', code: 'HW', description: 'Handwriting & Calligraphy (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 27, name: 'Yoruba', code: 'YOR', description: 'Yoruba Language, Culture & Literature (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 28, name: 'History', code: 'HIS', description: 'Nigerian & World History (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 29, name: 'Physical Health Education', code: 'PHE', description: 'Physical & Health Education, Sports and Wellness (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 30, name: 'Vocational Studies', code: 'VS', description: 'Vocational & Pre-Technical Studies (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 31, name: 'Security Education', code: 'SE', description: 'Security Education & Awareness (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 32, name: 'National Value Education', code: 'NVE', description: 'National Values Education, Civic Responsibilities (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 33, name: 'Marketing', code: 'MRK', description: 'Marketing & Commercial Enterprise (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 34, name: 'Garment Making', code: 'GM', description: 'Garment Making & Textile Design (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 35, name: 'Speech Work', code: 'SW', description: 'Speech Work, Phonetics & Diction (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 36, name: 'Geography', code: 'GEO', description: 'Earth, Environment, and Spatial Studies (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 37, name: 'Further Mathematics', code: 'FMTH', description: 'Advanced Pure & Applied Mathematics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 38, name: 'Financial Accounting', code: 'ACC', description: 'Bookkeeping and Financial Reporting (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 39, name: 'Islamic Religious Studies', code: 'IRS', description: 'Quranic Studies & Islamic Ethics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 40, name: 'Food and Nutrition', code: 'FNT', description: 'Food, Nutrition & Dietetics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 41, name: 'Business Studies', code: 'BST', description: 'Foundational Business & Commerce (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 42, name: 'Basic Technology', code: 'BTECH', description: 'Applied Technology, Technical Drawing & Workshop (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
];

const CUSTOM_SUBJECTS_KEY = 'fis_custom_subjects_v1';
const DELETED_SUBJECT_CODES_KEY = 'fis_deleted_subject_codes_v1';
const DELETED_SUBJECT_IDS_KEY = 'fis_deleted_subject_ids_v1';
const DELETED_SUBJECT_NAMES_KEY = 'fis_deleted_subject_names_v1';

export function getCustomSubjects(): Subject[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveCustomSubjectLocally(newSub: Subject): Subject[] {
  const current = getCustomSubjects();
  const existingIdx = current.findIndex(
    (s) => (s.id && newSub.id && Number(s.id) === Number(newSub.id)) ||
           s.code.toUpperCase() === newSub.code.toUpperCase() ||
           s.name.toLowerCase() === newSub.name.toLowerCase()
  );

  let updated: Subject[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...newSub };
  } else {
    updated = [newSub, ...current];
  }

  // Remove from deleted blacklists if re-created
  try {
    const rawCodes = localStorage.getItem(DELETED_SUBJECT_CODES_KEY);
    if (rawCodes) {
      const codeSet = new Set<string>(JSON.parse(rawCodes));
      codeSet.delete(newSub.code.toUpperCase());
      localStorage.setItem(DELETED_SUBJECT_CODES_KEY, JSON.stringify([...codeSet]));
    }
    const rawNames = localStorage.getItem(DELETED_SUBJECT_NAMES_KEY);
    if (rawNames) {
      const nameSet = new Set<string>(JSON.parse(rawNames));
      nameSet.delete(newSub.name.trim().toLowerCase());
      localStorage.setItem(DELETED_SUBJECT_NAMES_KEY, JSON.stringify([...nameSet]));
    }
  } catch (_) {}

  localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('fis:subjects-updated', { detail: updated }));
  return updated;
}

export function deleteSubjectLocally(id: number | string, code?: string, name?: string): void {
  const idStr = String(id);
  const codeUpper = (code || '').toUpperCase().trim();
  const nameLower = (name || '').toLowerCase().trim();

  // 1. Remove from local custom subjects
  const current = getCustomSubjects();
  const filtered = current.filter(
    (s) => String(s.id) !== idStr && (!codeUpper || s.code.toUpperCase() !== codeUpper) && (!nameLower || s.name.toLowerCase() !== nameLower)
  );
  localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(filtered));

  // 2. Add to deleted tracking sets so baseline / server cached subjects stay deleted
  try {
    const rawIds = localStorage.getItem(DELETED_SUBJECT_IDS_KEY);
    const idSet = new Set<string>(rawIds ? JSON.parse(rawIds) : []);
    idSet.add(idStr);
    localStorage.setItem(DELETED_SUBJECT_IDS_KEY, JSON.stringify([...idSet]));

    if (codeUpper) {
      const rawCodes = localStorage.getItem(DELETED_SUBJECT_CODES_KEY);
      const codeSet = new Set<string>(rawCodes ? JSON.parse(rawCodes) : []);
      codeSet.add(codeUpper);
      localStorage.setItem(DELETED_SUBJECT_CODES_KEY, JSON.stringify([...codeSet]));
    }

    if (nameLower) {
      const rawNames = localStorage.getItem(DELETED_SUBJECT_NAMES_KEY);
      const nameSet = new Set<string>(rawNames ? JSON.parse(rawNames) : []);
      nameSet.add(nameLower);
      localStorage.setItem(DELETED_SUBJECT_NAMES_KEY, JSON.stringify([...nameSet]));
    }
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('fis:subjects-updated', { detail: filtered }));
}

export async function fetchAllSubjectsUnified(token?: string | null): Promise<Subject[]> {
  const subjectMapById = new Map<number, Subject>();
  const subjectMapByName = new Map<string, Subject>();

  const registerSubject = (s: Subject) => {
    if (!s || !s.name) return;
    const cleanName = s.name.trim().toLowerCase();
    const numericId = Number(s.id);
    if (!isNaN(numericId) && numericId > 0) {
      subjectMapById.set(numericId, s);
    }
    subjectMapByName.set(cleanName, s);
  };

  // 1. Seed baseline subjects with their canonical database IDs
  for (const s of BASELINE_SUBJECTS) {
    registerSubject(s);
  }

  // 2. Direct Supabase Query (gives freshest real-time subjects and newly added subjects)
  try {
    const { data: supaSubs } = await supabase
      .from('subjects')
      .select('id, name, code, description, status')
      .order('id', { ascending: true });

    if (supaSubs && supaSubs.length > 0) {
      for (const s of supaSubs) {
        if (s.name) {
          const mapped: Subject = {
            id: s.id,
            name: s.name,
            code: s.code || s.name.slice(0, 4).toUpperCase(),
            description: s.description || '',
            status: (s.status as any) || 'active',
            isCompulsory: s.name.toLowerCase().includes('mathematics') || s.name.toLowerCase().includes('english'),
            defaultMaxRawScore: s.name.toLowerCase().includes('english') ? 60 : 40,
          };
          registerSubject(mapped);
        }
      }
    }
  } catch (supaErr) {
    console.warn('Supabase subjects fetch deferred:', supaErr);
  }

  // 3. Backend API Query
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/subjects', { headers });
    if (res.ok) {
      const text = await res.text();
      if (text && (text.startsWith('{') || text.startsWith('['))) {
        const data = JSON.parse(text);
        const serverSubs: Subject[] = data.subjects || [];
        for (const s of serverSubs) {
          if (s.name) {
            const mapped: Subject = {
              id: s.id,
              name: s.name,
              code: s.code || s.name.slice(0, 4).toUpperCase(),
              description: s.description || '',
              status: (s.status as any) || 'active',
              isCompulsory: s.name.toLowerCase().includes('mathematics') || s.name.toLowerCase().includes('english'),
              defaultMaxRawScore: s.name.toLowerCase().includes('english') ? 60 : 40,
            };
            registerSubject(mapped);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Backend subjects query deferred:', e);
  }

  // 4. Add local custom subjects (only if not already provided by database)
  const custom = getCustomSubjects();
  for (const s of custom) {
    if (s.name && !subjectMapByName.has(s.name.trim().toLowerCase())) {
      registerSubject(s);
    }
  }

  // Load deleted sets
  let deletedIds = new Set<string>();
  let deletedCodes = new Set<string>();
  let deletedNames = new Set<string>();
  try {
    const rawIds = localStorage.getItem(DELETED_SUBJECT_IDS_KEY);
    if (rawIds) deletedIds = new Set<string>(JSON.parse(rawIds));
    const rawCodes = localStorage.getItem(DELETED_SUBJECT_CODES_KEY);
    if (rawCodes) deletedCodes = new Set<string>(JSON.parse(rawCodes));
    const rawNames = localStorage.getItem(DELETED_SUBJECT_NAMES_KEY);
    if (rawNames) deletedNames = new Set<string>(JSON.parse(rawNames));
  } catch (_) {}

  // Consolidate list by ID (preserving exact database IDs)
  const allList = Array.from(subjectMapById.values()).filter((s) => {
    if (s.status === 'inactive') return false;
    if (s.id && deletedIds.has(String(s.id))) return false;
    if (s.code && deletedCodes.has(s.code.toUpperCase())) return false;
    if (s.name && deletedNames.has(s.name.trim().toLowerCase())) return false;
    return true;
  });

  // Sort by id ascending
  allList.sort((a, b) => Number(a.id) - Number(b.id));

  return allList;
}

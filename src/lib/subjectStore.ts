import { Subject } from '../types/index.ts';
import { supabase } from '../supabaseConfig.ts';

export const BASELINE_SUBJECTS: Subject[] = [
  { id: 1, name: 'Mathematics', code: 'MTH', description: 'Core Mathematics & Numeracy (Compulsory)', status: 'active', isCompulsory: true, defaultMaxRawScore: 40 },
  { id: 2, name: 'English Language', code: 'ENG', description: 'Grammar, Comprehension, & Composition (Compulsory • Graded over 60)', status: 'active', isCompulsory: true, defaultMaxRawScore: 60 },
  { id: 3, name: 'Biology', code: 'BIO', description: 'Life Sciences and Living Organisms (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 4, name: 'Physics', code: 'PHY', description: 'Mechanics, Energy, and Physical World (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 5, name: 'Chemistry', code: 'CHM', description: 'Matter, Reactions, and Organic Chemistry (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 6, name: 'Digital Technology', code: 'DGT', description: 'Computing, Digital Systems, & Innovation (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 7, name: 'ICT', code: 'ICT', description: 'Information & Communications Technology (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 8, name: 'Basic Science', code: 'BSC', description: 'Foundational Integrated Sciences (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 9, name: 'Economics', code: 'ECO', description: 'Micro & Macroeconomics, Markets, and Trade (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 10, name: 'Civic Education', code: 'CIV', description: 'Civic Responsibilities & Ethics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 11, name: 'Government', code: 'GOV', description: 'Political Institutions & Governance (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 12, name: 'Literature in English', code: 'LIT', description: 'Prose, Drama, & Poetry (Elective • Graded over 40 • Not Compulsory)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 13, name: 'Commerce', code: 'COM', description: 'Business & Commercial Studies (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 14, name: 'Agricultural Science', code: 'AGR', description: 'Crop & Animal Production (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 15, name: 'Geography', code: 'GEO', description: 'Earth, Environment, and Spatial Studies (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 16, name: 'Further Mathematics', code: 'FMTH', description: 'Advanced Pure & Applied Mathematics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 17, name: 'Financial Accounting', code: 'ACC', description: 'Bookkeeping and Financial Reporting (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 18, name: 'Christian Religious Studies', code: 'CRS', description: 'Biblical Studies & Christian Ethics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
  { id: 19, name: 'Islamic Religious Studies', code: 'IRS', description: 'Quranic Studies & Islamic Ethics (Elective • Graded over 40)', status: 'active', isCompulsory: false, defaultMaxRawScore: 40 },
];

const CUSTOM_SUBJECTS_KEY = 'fis_custom_subjects_v1';
const DELETED_SUBJECT_CODES_KEY = 'fis_deleted_subject_codes_v1';
const DELETED_SUBJECT_IDS_KEY = 'fis_deleted_subject_ids_v1';

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
    (s) => s.code.toUpperCase() === newSub.code.toUpperCase() || s.name.toLowerCase() === newSub.name.toLowerCase()
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
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('fis:subjects-updated', { detail: filtered }));
}


export async function fetchAllSubjectsUnified(token?: string | null): Promise<Subject[]> {
  const custom = getCustomSubjects();
  const mergedMap = new Map<string, Subject>();

  // 1. Add baseline subjects
  for (const s of BASELINE_SUBJECTS) {
    mergedMap.set(s.code.toUpperCase(), s);
  }

  // 2. Add local custom subjects
  for (const s of custom) {
    mergedMap.set(s.code.toUpperCase(), s);
  }

  // 3. Direct Supabase Query
  try {
    const { data: supaSubs } = await supabase
      .from('subjects')
      .select('id, name, code, description, status')
      .order('name', { ascending: true });

    if (supaSubs && supaSubs.length > 0) {
      for (const s of supaSubs) {
        if (s.code) {
          mergedMap.set(s.code.toUpperCase(), {
            id: s.id,
            name: s.name,
            code: s.code,
            description: s.description || '',
            status: s.status || 'active',
          });
        }
      }
    }
  } catch (supaErr) {
    console.warn('Supabase subjects fetch deferred:', supaErr);
  }

  // 4. Backend API Query
  if (token) {
    try {
      const res = await fetch('/api/subjects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && (text.startsWith('{') || text.startsWith('['))) {
          const data = JSON.parse(text);
          const serverSubs: Subject[] = data.subjects || [];
          for (const s of serverSubs) {
            if (s.code) {
              mergedMap.set(s.code.toUpperCase(), {
                id: s.id,
                name: s.name,
                code: s.code,
                description: s.description || '',
                status: s.status || 'active',
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Backend subjects query deferred:', e);
    }
  }

  // Load deleted sets
  let deletedIds = new Set<string>();
  let deletedCodes = new Set<string>();
  try {
    const rawIds = localStorage.getItem(DELETED_SUBJECT_IDS_KEY);
    if (rawIds) deletedIds = new Set<string>(JSON.parse(rawIds));
    const rawCodes = localStorage.getItem(DELETED_SUBJECT_CODES_KEY);
    if (rawCodes) deletedCodes = new Set<string>(JSON.parse(rawCodes));
  } catch (_) {}

  const allList = Array.from(mergedMap.values()).filter((s) => {
    if (s.status === 'inactive') return false;
    if (s.id && deletedIds.has(String(s.id))) return false;
    if (s.code && deletedCodes.has(s.code.toUpperCase())) return false;
    return true;
  });


  // Guarantee strictly unique integer IDs across all subjects to prevent React duplicate key collisions
  const seenIds = new Set<number>();
  let nextUniqueId = 1000;
  for (const s of allList) {
    if (!s.id || seenIds.has(s.id)) {
      while (seenIds.has(nextUniqueId)) {
        nextUniqueId++;
      }
      s.id = nextUniqueId++;
    }
    seenIds.add(s.id);
  }

  // Cache custom subjects locally so they persist across reloads
  try {
    const baseCodes = new Set(BASELINE_SUBJECTS.map((b) => b.code.toUpperCase()));
    const customOnly = allList.filter((s) => !baseCodes.has(s.code.toUpperCase()));
    if (customOnly.length > 0) {
      localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(customOnly));
    }
  } catch (_) {}

  return allList;
}

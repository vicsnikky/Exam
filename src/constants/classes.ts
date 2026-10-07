export const SCHOOL_CLASSES = [
  'Creche',
  'KG 1',
  'KG 2',
  'NUR 1',
  'NUR 2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'JSS 1',
  'JSS 2',
  'JSS 3',
  'SSS 1',
  'SSS 2',
  'SS 3',
] as const;

export type SchoolClass = (typeof SCHOOL_CLASSES)[number];

export const SCHOOL_CLASS_OPTIONS = [
  { value: 'Creche', label: 'Creche (Early Years / Daycare)' },
  { value: 'KG 1', label: 'KG 1 (Kindergarten 1)' },
  { value: 'KG 2', label: 'KG 2 (Kindergarten 2)' },
  { value: 'NUR 1', label: 'NUR 1 (Nursery 1)' },
  { value: 'NUR 2', label: 'NUR 2 (Nursery 2)' },
  { value: 'Primary 1', label: 'Primary 1 (Basic 1)' },
  { value: 'Primary 2', label: 'Primary 2 (Basic 2)' },
  { value: 'Primary 3', label: 'Primary 3 (Basic 3)' },
  { value: 'Primary 4', label: 'Primary 4 (Basic 4)' },
  { value: 'Primary 5', label: 'Primary 5 (Basic 5)' },
  { value: 'JSS 1', label: 'JSS 1 (Junior Secondary 1)' },
  { value: 'JSS 2', label: 'JSS 2 (Junior Secondary 2)' },
  { value: 'JSS 3', label: 'JSS 3 (Junior Secondary 3)' },
  { value: 'SSS 1', label: 'SSS 1 (Senior Secondary 1)' },
  { value: 'SSS 2', label: 'SSS 2 (Senior Secondary 2)' },
  { value: 'SS 3', label: 'SS 3 (Senior Secondary 3 - Final Mock)' },
] as const;

export function normalizeClassName(className?: string | null): string {
  if (!className) return '';
  const clean = className.trim().toUpperCase().replace(/\s+/g, ' ');
  if (clean === 'CRECHE') return 'Creche';
  if (clean === 'KG1' || clean === 'KG 1' || clean === 'KINDERGARTEN 1') return 'KG 1';
  if (clean === 'KG2' || clean === 'KG 2' || clean === 'KINDERGARTEN 2') return 'KG 2';
  if (clean === 'NUR1' || clean === 'NUR 1' || clean === 'NURSERY 1') return 'NUR 1';
  if (clean === 'NUR2' || clean === 'NUR 2' || clean === 'NURSERY 2') return 'NUR 2';
  if (clean === 'PRIMARY 1' || clean === 'PRI 1' || clean === 'BASIC 1' || clean === 'PRIMARY1') return 'Primary 1';
  if (clean === 'PRIMARY 2' || clean === 'PRI 2' || clean === 'BASIC 2' || clean === 'PRIMARY2') return 'Primary 2';
  if (clean === 'PRIMARY 3' || clean === 'PRI 3' || clean === 'BASIC 3' || clean === 'PRIMARY3') return 'Primary 3';
  if (clean === 'PRIMARY 4' || clean === 'PRI 4' || clean === 'BASIC 4' || clean === 'PRIMARY4') return 'Primary 4';
  if (clean === 'PRIMARY 5' || clean === 'PRI 5' || clean === 'BASIC 5' || clean === 'PRIMARY5') return 'Primary 5';
  if (clean === 'JSS1' || clean === 'JSS 1' || clean === 'JS 1' || clean === 'JS1') return 'JSS 1';
  if (clean === 'JSS2' || clean === 'JSS 2' || clean === 'JS 2' || clean === 'JS2') return 'JSS 2';
  if (clean === 'JSS3' || clean === 'JSS 3' || clean === 'JS 3' || clean === 'JS3') return 'JSS 3';
  if (clean === 'SSS1' || clean === 'SSS 1' || clean === 'SS 1' || clean === 'SS1') return 'SSS 1';
  if (clean === 'SSS2' || clean === 'SSS 2' || clean === 'SS 2' || clean === 'SS2') return 'SSS 2';
  if (clean === 'SS3' || clean === 'SS 3' || clean === 'SSS 3' || clean === 'SSS3') return 'SS 3';
  return className;
}

export function isSameClass(classA?: string | null, classB?: string | null): boolean {
  if (!classA || !classB) return false;
  if (classA.toLowerCase() === 'all' || classB.toLowerCase() === 'all') return true;
  return normalizeClassName(classA) === normalizeClassName(classB);
}

export function isSecondaryClass(className?: string | null): boolean {
  if (!className) return false;
  const c = className.toUpperCase().trim();
  return (
    c.includes('JSS') ||
    c.includes('JS ') ||
    c.includes('JS1') ||
    c.includes('JS2') ||
    c.includes('JS3') ||
    c.includes('SSS') ||
    c.includes('SS ') ||
    c.includes('SS1') ||
    c.includes('SS2') ||
    c.includes('SS3') ||
    c.includes('SECONDARY')
  );
}

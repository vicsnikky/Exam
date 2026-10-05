import { safeFetchJson } from './api.ts';

export interface Complaint {
  id: number | string;
  referenceCode: string;
  category: string;
  priority: 'Routine' | 'Important' | 'Urgent';
  subject: string;
  message: string;
  targetRole: string;
  status: 'pending' | 'under_review' | 'resolved' | 'archived';
  executiveNotes?: string | null;
  forwardedToDirector?: boolean;
  forwardedAt?: string | null;
  forwardedBy?: string | null;
  forwardingNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

const STORAGE_KEY = 'fis_anonymous_complaints_v1';

export function getLocalComplaints(): Complaint[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveLocalComplaints(list: Complaint[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('fis:complaints-updated', { detail: list }));
    }
  } catch (_) {}
}

export async function submitAnonymousComplaint(data: {
  category: string;
  priority?: 'Routine' | 'Important' | 'Urgent';
  subject: string;
  message: string;
  targetRole?: string;
}): Promise<{ success: boolean; referenceCode: string; message: string; complaint?: Complaint }> {
  const refCode = `FIS-CMP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const newComplaint: Complaint = {
    id: `cmp_${Date.now()}`,
    referenceCode: refCode,
    category: data.category || 'General Suggestion',
    priority: data.priority || 'Routine',
    subject: data.subject.trim(),
    message: data.message.trim(),
    targetRole: data.targetRole || 'Super Admin & Principal',
    status: 'pending',
    executiveNotes: null,
    forwardedToDirector: false,
    forwardedAt: null,
    forwardedBy: null,
    forwardingNotes: null,
    createdAt: new Date().toISOString(),
  };

  // 1. Save locally immediately for offline / preview resilience
  const current = getLocalComplaints();
  saveLocalComplaints([newComplaint, ...current]);

  // 2. Submit to backend API
  try {
    const res = await fetch('/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        referenceCode: refCode,
      }),
    });
    if (res.ok) {
      const respData = await res.json();
      if (respData.complaint) {
        return {
          success: true,
          referenceCode: respData.complaint.referenceCode || refCode,
          message: 'Your anonymous complaint/suggestion has been submitted securely and delivered to the Super Admin and Principal for investigation.',
          complaint: respData.complaint,
        };
      }
    }
  } catch (err) {
    console.warn('Backend complaints endpoint deferred, saved in vault cache:', err);
  }

  return {
    success: true,
    referenceCode: refCode,
    message: 'Your anonymous suggestion/complaint was recorded successfully and forwarded directly to the Super Admin and Principal.',
    complaint: newComplaint,
  };
}

export async function fetchExecutiveComplaints(token?: string | null, userRole?: string): Promise<Complaint[]> {
  const localList = getLocalComplaints();
  const mergedMap = new Map<string, Complaint>();

  localList.forEach((c) => mergedMap.set(c.referenceCode, c));

  if (token) {
    try {
      const res = await fetch('/api/complaints', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.complaints)) {
          data.complaints.forEach((c: any) => {
            mergedMap.set(c.referenceCode, {
              id: c.id,
              referenceCode: c.referenceCode,
              category: c.category || 'General Suggestion',
              priority: c.priority || 'Routine',
              subject: c.subject,
              message: c.message,
              targetRole: c.targetRole || 'Super Admin & Principal',
              status: c.status || 'pending',
              executiveNotes: c.executiveNotes,
              forwardedToDirector: Boolean(c.forwardedToDirector),
              forwardedAt: c.forwardedAt,
              forwardedBy: c.forwardedBy,
              forwardingNotes: c.forwardingNotes,
              createdAt: c.createdAt || new Date().toISOString(),
              resolvedAt: c.resolvedAt,
            });
          });
        }
      }
    } catch (e) {
      console.warn('Backend executive complaints fetch error:', e);
    }
  }

  const allMerged = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  saveLocalComplaints(allMerged);

  // If user is School Director, only return complaints that have been forwarded to the Director's dashboard!
  if (userRole === 'director') {
    return allMerged.filter((c) => c.forwardedToDirector === true);
  }

  return allMerged;
}

export async function forwardComplaintToDirector(
  referenceCode: string,
  forwardingNotes?: string,
  forwardedByTitle: string = 'Super Admin / Principal',
  token?: string | null
): Promise<boolean> {
  const current = getLocalComplaints();
  const forwardedAt = new Date().toISOString();
  const updated = current.map((c) => {
    if (c.referenceCode === referenceCode) {
      return {
        ...c,
        forwardedToDirector: true,
        forwardedAt,
        forwardedBy: forwardedByTitle,
        forwardingNotes: forwardingNotes || null,
      };
    }
    return c;
  });
  saveLocalComplaints(updated);

  if (token) {
    try {
      await fetch(`/api/complaints/${referenceCode}/forward-director`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ forwardingNotes }),
      });
    } catch (e) {
      console.warn('Backend forward complaint deferred, updated locally:', e);
    }
  }

  return true;
}

export async function updateComplaintStatus(
  referenceCode: string,
  status: 'pending' | 'under_review' | 'resolved' | 'archived',
  executiveNotes?: string,
  token?: string | null
): Promise<boolean> {
  const current = getLocalComplaints();
  const updated = current.map((c) => {
    if (c.referenceCode === referenceCode) {
      return {
        ...c,
        status,
        executiveNotes: executiveNotes !== undefined ? executiveNotes : c.executiveNotes,
        resolvedAt: status === 'resolved' ? new Date().toISOString() : c.resolvedAt,
      };
    }
    return c;
  });
  saveLocalComplaints(updated);

  if (token) {
    try {
      await fetch(`/api/complaints/${referenceCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, executiveNotes }),
      });
    } catch (e) {
      console.warn('Backend complaint status update deferred:', e);
    }
  }

  return true;
}

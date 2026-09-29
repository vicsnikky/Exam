/**
 * Universal safe JSON fetch helper
 * Guarantees that non-JSON responses (such as Vercel 500 plain text errors)
 * will NEVER throw SyntaxError: "Unexpected token 'A'..."
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit,
  fallback?: T
): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let errMsg = `Request failed (${res.status})`;
      if (text && (text.startsWith('{') || text.startsWith('['))) {
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed.error || parsed.message || errMsg;
        } catch (_) {}
      } else if (text && text.length < 120 && !text.includes('<html')) {
        errMsg = text.trim();
      }
      return { ok: false, data: fallback ?? null, error: errMsg };
    }

    const text = await res.text();
    if (!text || (!text.startsWith('{') && !text.startsWith('['))) {
      return { ok: false, data: fallback ?? null, error: 'Server did not return valid JSON' };
    }

    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, data: fallback ?? null, error: err?.message || 'Network request failed' };
  }
}

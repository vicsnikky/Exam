/**
 * Extracts a human-readable message from any API error, response body, or exception.
 * Prevents JavaScript from ever coercing error objects to "[object Object]".
 */
export function extractErrorMessage(err: any, fallback = 'An unexpected error occurred'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message !== '[object Object]') {
    return err.message;
  }
  if (err.error) {
    if (typeof err.error === 'string') return err.error;
    if (typeof err.error.message === 'string') return err.error.message;
    if (err.error.code === 'FUNCTION_INVOCATION_FAILED') {
      return 'Vercel Serverless Function encountered an error. Please verify your DATABASE_URL in Vercel project environment variables.';
    }
    if (typeof err.error.code === 'string') return `Server error (${err.error.code})`;
    try {
      const s = JSON.stringify(err.error);
      return s !== '{}' ? s : fallback;
    } catch {
      return fallback;
    }
  }
  try {
    const s = JSON.stringify(err);
    return s !== '{}' && s !== 'null' ? s : fallback;
  } catch {
    return fallback;
  }
}

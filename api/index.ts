import app from '../server.ts';

export default function handler(req: any, res: any) {
  try {
    if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url}`;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Serverless function invocation error:', err);
    return res.status(500).json({
      error: err?.message || 'Internal Serverless Execution Error',
    });
  }
}

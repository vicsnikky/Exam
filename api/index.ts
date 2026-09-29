import app from '../server.ts';

export default async function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Serverless Invocation Exception:', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err?.message || 'Serverless invocation error' }));
    }
  }
}

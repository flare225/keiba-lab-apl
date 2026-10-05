import worker from '../src/index-v1.13.js';

export default async function handler(req, res) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const originalPath = req.headers['x-vercel-original-path'] || req.url || '/';
    const url = `${proto}://${host}${originalPath}`;
    const request = new Request(url, { method: 'GET', headers: req.headers });
    const response = await worker.fetch(request);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const body = Buffer.from(await response.arrayBuffer());
    res.send(body);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message || error) });
  }
}

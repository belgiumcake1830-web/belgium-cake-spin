// Thin wrapper around the Supabase REST API (no packages needed).
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  if (!URL_ || !KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.message || `Supabase error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Dubai is UTC+4 all year (no daylight saving).
export function dubaiToday() {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

export function normalizeCode(c) {
  return String(c || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function send(res, status, obj) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(obj);
}

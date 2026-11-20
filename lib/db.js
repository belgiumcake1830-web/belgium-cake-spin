// Thin wrapper around the Supabase REST API (no packages needed).
// Works with both new-style keys (sb_secret_...) and legacy service_role keys (eyJ...).
const KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const URL_ = (process.env.SUPABASE_URL || '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  if (!URL_ || !KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      // New secret keys are not JWTs and must be sent in "apikey" only.
      // Legacy JWT keys also go in Authorization.
      ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 200) };
  }
  if (!res.ok) {
    const err = new Error(data?.message || `Supabase error ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
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

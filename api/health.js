import { sb, send } from '../lib/db.js';

// GET /api/health  -> shows what is wrong with the setup. Reveals no secrets.
// You can delete this file once everything works.

function keyKind(key) {
  if (!key) return 'MISSING';
  if (key.startsWith('sb_secret_')) return 'ok (secret key)';
  if (key.startsWith('sb_publishable_')) return 'WRONG: this is the publishable key. Use the SECRET key.';
  if (key.startsWith('eyJ')) {
    try {
      const role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
      return role === 'service_role'
        ? 'ok (legacy service_role key)'
        : `WRONG: this is the "${role}" key. Use the service_role / secret key.`;
    } catch {
      return 'WRONG: key looks damaged. Copy it again, the whole key.';
    }
  }
  return 'WRONG: this is not a Supabase key. Copy the whole secret key again.';
}

export default async function handler(req, res) {
  const env = (n) => (String(process.env[n] || '').trim() ? 'set' : 'MISSING');
  const url = String(process.env.SUPABASE_URL || '').trim();
  const urlStatus = !url
    ? 'MISSING'
    : /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url)
      ? 'ok'
      : 'CHECK: should look like https://abcdefgh.supabase.co (no extra words after .co)';

  const out = {
    SUPABASE_URL: urlStatus,
    SUPABASE_SERVICE_KEY: keyKind(String(process.env.SUPABASE_SERVICE_KEY || '').trim()),
    STAFF_PIN: env('STAFF_PIN'),
    CHECKOUT_SECRET: env('CHECKOUT_SECRET'),
    ADMIN_PIN: env('ADMIN_PIN'),
    database: 'not tested',
  };

  if (urlStatus !== 'MISSING' && env('SUPABASE_SERVICE_KEY') === 'set') {
    try {
      await sb('discount_codes?select=id,order_amount&limit=1');
      out.database = 'ok: table found';
    } catch (err) {
      const m = String(err.message || '');
      if (/order_amount/.test(m)) out.database = 'Table needs one update: run supabase-update.sql in Supabase SQL Editor.';
      else if (err.status === 404 || err.code === 'PGRST205' || /discount_codes/.test(m))
        out.database = 'TABLE MISSING: run supabase.sql in Supabase SQL Editor (in the same project as this URL).';
      else if (err.status === 401 || err.status === 403) out.database = 'KEY REJECTED by Supabase: wrong or old key.';
      else out.database = `Error ${err.status || ''}: ${m.slice(0, 160)}`;
    }
  }
  return send(res, 200, out);
}

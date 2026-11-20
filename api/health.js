import { sb, send } from '../lib/db.js';

// GET /api/health  -> shows what is wrong with the setup. Reveals no secrets.
// You can delete this file once everything works.

function keyInfo(key) {
  if (!key) return { text: 'MISSING', ref: null };
  if (key.startsWith('sb_secret_')) return { text: 'ok (secret key)', ref: null };
  if (key.startsWith('sb_publishable_'))
    return { text: 'WRONG: this is the publishable key. Use the SECRET key.', ref: null };
  if (key.startsWith('eyJ')) {
    try {
      const p = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      return {
        text:
          p.role === 'service_role'
            ? 'ok (legacy service_role key)'
            : `WRONG: this is the "${p.role}" key. Use the service_role / secret key.`,
        ref: p.ref || null,
      };
    } catch {
      return { text: 'WRONG: key looks damaged. Copy it again, the whole key.', ref: null };
    }
  }
  return { text: 'WRONG: this is not a Supabase key. Copy the whole secret key again.', ref: null };
}

export default async function handler(req, res) {
  const env = (n) => (String(process.env[n] || '').trim() ? 'set' : 'MISSING');
  const url = String(process.env.SUPABASE_URL || '').trim();
  const urlOk = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url);
  const urlRef = urlOk ? url.replace(/^https:\/\//i, '').split('.')[0].toLowerCase() : null;
  const key = keyInfo(String(process.env.SUPABASE_SERVICE_KEY || '').trim());

  const out = {
    SUPABASE_URL: !url
      ? 'MISSING'
      : urlOk
        ? 'ok'
        : 'CHECK: should look like https://abcdefgh.supabase.co (no extra words after .co)',
    projectInUrl: urlRef,
    SUPABASE_SERVICE_KEY: key.text,
    projectInKey: key.ref || 'not shown for this key type',
    STAFF_PIN: env('STAFF_PIN'),
    CHECKOUT_SECRET: env('CHECKOUT_SECRET'),
    ADMIN_PIN: env('ADMIN_PIN'),
    database: 'not tested',
  };
  if (urlRef && key.ref && urlRef !== key.ref.toLowerCase()) {
    out.SUPABASE_SERVICE_KEY += ' | MISMATCH: this key belongs to a DIFFERENT Supabase project than the URL.';
  }

  if (url && env('SUPABASE_SERVICE_KEY') === 'set') {
    try {
      await sb('discount_codes?select=id,order_amount&limit=1');
      out.database = 'ok: table found';
    } catch (err) {
      const m = String(err.message || '');
      const detail = ` [status ${err.status || 'none'}: ${m.slice(0, 140)}]`;
      if (/order_amount/.test(m)) out.database = 'Table needs one update: run supabase-update.sql in Supabase SQL Editor.' + detail;
      else if (err.status === 404 || err.code === 'PGRST205' || /discount_codes/.test(m))
        out.database = 'TABLE NOT FOUND in the project above.' + detail;
      else if (err.status === 401 || err.status === 403) out.database = 'KEY REJECTED by Supabase: wrong or old key.' + detail;
      else out.database = 'Error.' + detail;
    }
  }
  return send(res, 200, out);
}

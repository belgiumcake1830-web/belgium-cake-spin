import { sb, normalizeCode, send } from '../lib/db.js';

// POST /api/validate   body: { code }
// Check only. Does NOT use the code up. Safe to call from the checkout page
// to show the discount before the customer pays.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  try {
    const code = normalizeCode(req.body?.code);
    if (!/^BC-[A-Z0-9]{6}$/.test(code)) {
      return send(res, 200, { valid: false, reason: 'invalid', message: 'Code not found.' });
    }

    const rows = await sb(
      `discount_codes?select=code,percent,expires_at,used,used_at,used_channel&code=eq.${code}&limit=1`
    );
    if (!rows.length) {
      return send(res, 200, { valid: false, reason: 'invalid', message: 'Code not found.' });
    }

    const r = rows[0];
    if (r.used) {
      return send(res, 200, {
        valid: false,
        reason: 'used',
        message: 'This code was already used.',
        usedAt: r.used_at,
        usedChannel: r.used_channel,
      });
    }
    if (new Date(r.expires_at) <= new Date()) {
      return send(res, 200, { valid: false, reason: 'expired', message: 'This code has expired.' });
    }
    return send(res, 200, {
      valid: true,
      percent: r.percent,
      expiresAt: r.expires_at,
      message: `Valid: ${r.percent}% off`,
    });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Server error, please try again.' });
  }
}

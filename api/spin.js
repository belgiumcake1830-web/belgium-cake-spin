import { timingSafeEqual } from 'node:crypto';
import { sb, normalizeCode, send } from '../lib/db.js';

function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

// POST /api/redeem   body: { code }
// Marks the code as USED. One call only works once, even if two people
// try at the same moment (the database update is atomic).
//
// Who may call it:
//   counter  -> header  x-staff-pin: <STAFF_PIN>
//   online   -> header  x-checkout-secret: <CHECKOUT_SECRET>   (server-to-server only!)
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  let channel = null;
  if (same(req.headers['x-staff-pin'], process.env.STAFF_PIN)) channel = 'counter';
  else if (same(req.headers['x-checkout-secret'], process.env.CHECKOUT_SECRET)) channel = 'online';
  if (!channel) return send(res, 401, { error: 'Not allowed.' });

  try {
    const code = normalizeCode(req.body?.code);
    if (!/^BC-[A-Z0-9]{6}$/.test(code)) {
      return send(res, 200, { ok: false, reason: 'invalid', message: 'Code not found.' });
    }

    // Optional order total (before discount). Used only for the owner dashboard.
    const rawAmount = Number(req.body?.amount);
    const amount = Number.isFinite(rawAmount) && rawAmount > 0 && rawAmount < 1e6 ? rawAmount : null;

    const nowIso = new Date().toISOString();
    // Atomic: only updates the row if it is still unused AND not expired.
    const updated = await sb(
      `discount_codes?code=eq.${code}&used=eq.false&expires_at=gt.${encodeURIComponent(nowIso)}` +
        `&select=code,percent`,
      {
        method: 'PATCH',
        body: {
          used: true,
          used_at: nowIso,
          used_channel: channel,
          ...(amount !== null ? { order_amount: amount } : {}),
        },
        prefer: 'return=representation',
      }
    );

    if (updated.length) {
      return send(res, 200, {
        ok: true,
        percent: updated[0].percent,
        message: `Applied ${updated[0].percent}% off`,
      });
    }

    // Nothing updated: find out why.
    const rows = await sb(`discount_codes?select=used,used_at,used_channel,expires_at&code=eq.${code}&limit=1`);
    if (!rows.length) return send(res, 200, { ok: false, reason: 'invalid', message: 'Code not found.' });
    if (rows[0].used) {
      return send(res, 200, {
        ok: false,
        reason: 'used',
        message: 'This code was already used.',
        usedAt: rows[0].used_at,
        usedChannel: rows[0].used_channel,
      });
    }
    return send(res, 200, { ok: false, reason: 'expired', message: 'This code has expired.' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Server error, please try again.' });
  }
}

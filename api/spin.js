import { sb, dubaiToday, send } from '../lib/db.js';
import { tierFor, pickPercent, makeCode, CODE_VALID_DAYS, MAX_DAYS_AHEAD } from '../lib/rules.js';

// POST /api/spin   body: { phone, eventDate: "YYYY-MM-DD" }
// The SERVER picks the discount. The browser only shows the animation.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  try {
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    const eventDate = String(req.body?.eventDate || '');

    if (phone.length < 8 || phone.length > 15) {
      return send(res, 400, { error: 'Please enter a valid phone number.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return send(res, 400, { error: 'Please choose the date you need the order.' });
    }

    const today = dubaiToday();
    const daysAhead = Math.round((Date.parse(eventDate) - Date.parse(today)) / 86400000);
    if (Number.isNaN(daysAhead) || daysAhead < 0 || daysAhead > MAX_DAYS_AHEAD) {
      return send(res, 400, { error: `Choose a date from today up to ${MAX_DAYS_AHEAD} days ahead.` });
    }

    const tier = tierFor(daysAhead);

    // One spin per phone number per day: return the earlier result instead.
    const dayStart = new Date(`${today}T00:00:00+04:00`).toISOString();
    const existing = await sb(
      `discount_codes?select=code,percent,expires_at,used,days_ahead` +
        `&phone=eq.${phone}&created_at=gte.${encodeURIComponent(dayStart)}&limit=1`
    );
    if (existing.length) {
      const e = existing[0];
      return send(res, 200, {
        already: true,
        code: e.code,
        percent: e.percent,
        expiresAt: e.expires_at,
        used: e.used,
        range: { min: tier.min, max: tier.max },
      });
    }

    const percent = pickPercent(tier);
    const expiresAt = new Date(Date.now() + CODE_VALID_DAYS * 86400000).toISOString();

    // Insert with a unique code; retry if (very unlikely) the code already exists.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      try {
        await sb('discount_codes', {
          method: 'POST',
          body: { code, phone, percent, days_ahead: daysAhead, expires_at: expiresAt },
          prefer: 'return=minimal',
        });
        return send(res, 200, {
          already: false,
          code,
          percent,
          expiresAt,
          range: { min: tier.min, max: tier.max },
        });
      } catch (err) {
        if (err.status !== 409) throw err; // 409 = duplicate code, try again
      }
    }
    return send(res, 500, { error: 'Could not create a code, please try again.' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Server error, please try again.' });
  }
}

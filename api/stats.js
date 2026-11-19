import { timingSafeEqual } from 'node:crypto';
import { sb, dubaiToday, send } from '../lib/db.js';

function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

const dayKey = (iso) => new Date(Date.parse(iso) + 4 * 3600 * 1000).toISOString().slice(0, 10);

const BUCKETS = [
  { label: '0-1 days', min: 0, max: 1 },
  { label: '2-3 days', min: 2, max: 3 },
  { label: '4-6 days', min: 4, max: 6 },
  { label: '7+ days', min: 7, max: 9999 },
];

// POST /api/stats   header: x-admin-pin: <ADMIN_PIN>
// Owner dashboard data. Read only.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!same(req.headers['x-admin-pin'], process.env.ADMIN_PIN)) {
    return send(res, 401, { error: 'Wrong PIN.' });
  }

  try {
    // Read all codes in pages of 1000 (Supabase's default page size).
    const cols = 'code,phone,percent,days_ahead,created_at,expires_at,used,used_at,used_channel,order_amount';
    let rows = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
      const page = await sb(`discount_codes?select=${cols}&order=created_at.desc&limit=1000&offset=${offset}`);
      rows = rows.concat(page);
      if (page.length < 1000) break;
    }

    const now = Date.now();
    const today = dubaiToday();
    const status = (r) => (r.used ? 'used' : Date.parse(r.expires_at) <= now ? 'expired' : 'active');

    const totals = { issued: rows.length, used: 0, active: 0, expired: 0 };
    const todayStats = { issued: 0, used: 0 };
    const sales = { orders: 0, sales: 0, discount: 0 };
    const byPercent = {};
    const byChannel = { counter: 0, online: 0 };
    const buckets = BUCKETS.map((b) => ({ label: b.label, issued: 0, used: 0 }));

    // Last 14 days, oldest first.
    const days = [];
    for (let i = 13; i >= 0; i--) {
      days.push(new Date(Date.parse(today) - i * 86400000).toISOString().slice(0, 10));
    }
    const daily = Object.fromEntries(days.map((d) => [d, { date: d, issued: 0, used: 0 }]));

    for (const r of rows) {
      const s = status(r);
      totals[s]++;

      const created = dayKey(r.created_at);
      if (created === today) todayStats.issued++;
      if (daily[created]) daily[created].issued++;

      byPercent[r.percent] ??= { percent: r.percent, issued: 0, used: 0 };
      byPercent[r.percent].issued++;

      const bi = BUCKETS.findIndex((b) => r.days_ahead >= b.min && r.days_ahead <= b.max);
      if (bi >= 0) {
        buckets[bi].issued++;
        if (r.used) buckets[bi].used++;
      }

      if (r.used) {
        byPercent[r.percent].used++;
        if (byChannel[r.used_channel] !== undefined) byChannel[r.used_channel]++;
        if (r.used_at) {
          const u = dayKey(r.used_at);
          if (u === today) todayStats.used++;
          if (daily[u]) daily[u].used++;
        }
        if (r.order_amount !== null && r.order_amount !== undefined) {
          const amt = Number(r.order_amount);
          sales.orders++;
          sales.sales += amt;
          sales.discount += (amt * r.percent) / 100;
        }
      }
    }

    return send(res, 200, {
      generatedAt: new Date().toISOString(),
      totals,
      redemptionRate: totals.issued ? totals.used / totals.issued : 0,
      today: todayStats,
      sales: {
        orders: sales.orders,
        sales: Math.round(sales.sales * 100) / 100,
        discount: Math.round(sales.discount * 100) / 100,
      },
      byChannel,
      byPercent: Object.values(byPercent).sort((a, b) => a.percent - b.percent),
      byDaysAhead: buckets,
      daily: days.map((d) => daily[d]),
      recent: rows.slice(0, 150).map((r) => ({
        code: r.code,
        phone: r.phone,
        percent: r.percent,
        daysAhead: r.days_ahead,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        status: status(r),
        usedAt: r.used_at,
        usedChannel: r.used_channel,
        orderAmount: r.order_amount,
      })),
    });
  } catch (err) {
    console.error(err);
    const hint = /order_amount/.test(err.message)
      ? 'Database needs the update: run supabase-update.sql in Supabase.'
      : 'Server error, please try again.';
    return send(res, 500, { error: hint });
  }
}

# Belgium Cake: Spin & Save discount system

Customer spins a wheel, gets a one-time code (1-20% depending on how many days ahead they order).
Staff check and use the code at the counter. The online shop checks and uses it at checkout.
Every code is stored in a database, so a code can only be used once.

## What is inside

| File | Purpose |
|---|---|
| `index.html` | Customer page with the spin wheel (`/`) |
| `staff.html` | Counter page: check or use a code (`/staff`) |
| `api/spin.js` | Creates the code. The server picks the %, not the browser |
| `api/validate.js` | Checks a code without using it |
| `api/redeem.js` | Uses the code up (works only once) |
| `admin.html` | **Owner dashboard** (`/admin`), protected by `ADMIN_PIN` |
| `api/stats.js` | Gives the dashboard its numbers (read only) |
| `lib/rules.js` | **Edit your discount rules here** |
| `supabase.sql` | Creates the database table (new installs) |
| `supabase-update.sql` | Only if you already created the table from the first version |

## Setup (about 15 minutes, all free)

1. **Database:** create a free project at supabase.com. Open *SQL Editor*, paste the contents of `supabase.sql`, click *Run*.
2. **Keys:** in Supabase go to *Project Settings > API*. Copy the *Project URL* and the *service_role* key. Never put the service_role key in a web page.
3. **Deploy:** put this folder on GitHub and import it in Vercel (or run `vercel` from this folder).
4. **Environment variables** (Vercel project > Settings > Environment Variables):
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_SERVICE_KEY` = your service_role key
   - `STAFF_PIN` = a PIN for your staff (for example 6 digits)
   - `CHECKOUT_SECRET` = a long random text (used only by your online shop's server)
   - `ADMIN_PIN` = your own private PIN for the owner dashboard (different from the staff PIN)
5. Redeploy once after adding the variables.
6. Open `https://YOUR-SITE.vercel.app/` for customers, `/staff` for the counter, and `/admin` for you (owner).

If you already set up the first version: run `supabase-update.sql` once in Supabase, add `ADMIN_PIN`, and redeploy.

## Owner dashboard (`/admin`)

Open it on your phone or computer and enter `ADMIN_PIN`. It shows:
- Codes issued and used today, total issued, total used, and the used rate
- Sales made with codes and total discount given (needs the order total, see below)
- Last 14 days: codes issued vs used
- Whether ordering early works: used rate for each "days ahead" group
- Which discount % customers win most, and how many of each were used
- Counter vs online use
- Latest 150 codes with search and filters (Active, Used, Expired)

It refreshes by itself every minute.

**Order total:** when staff press "Apply & use" they can type the order total (before discount) in the optional box.
For online orders, send `"amount": 250` in the `/api/redeem` call. Without it, the code still works, but the sale
will not be counted in "Sales with codes".

## Discount rules

Default, in `lib/rules.js`:

| Days before the date they need the order | Possible discount |
|---|---|
| 7 or more | 10-20% |
| 4-6 | 7-15% |
| 2-3 | 4-10% |
| 0-1 | 1-5% |

Check your margin on big cakes before keeping the 20% top value.

Other rules in the same file: a won code is valid for 7 days, and the order date can be up to 60 days ahead.
One spin per phone number per day (a second try shows the same code again).

## Online checkout (your website)

1. Show the discount: call `POST /api/validate` with `{ "code": "BC-XXXXXX" }`. It returns `valid`, `percent`, or a reason (`invalid`, `used`, `expired`).
2. When the order is confirmed or paid, call `POST /api/redeem` **from your server** with the header `x-checkout-secret: <CHECKOUT_SECRET>` and body `{ "code": "BC-XXXXXX", "amount": 250 }` (`amount` = order total before discount, optional, for the dashboard).
   Use the percent returned by this call to price the order. If `ok` is false, do not give the discount.

Never call `/api/redeem` from the customer's browser, because that would expose the secret.

If your website runs on n8n, use an HTTP Request node for both calls.

## Counter

Staff open `/staff`, type the PIN once, type the customer's code, then:
- **Check only**: shows valid / used / expired
- **Apply & use**: marks the code as used. Press it only when the customer is paying.

## Good to know

- Codes look like `BC-7K9X2M`. Letters that look alike (0/O, 1/I) are left out.
- The raw data is also in the `discount_codes` table in Supabase (Table Editor).
- Keep `ADMIN_PIN` private: the dashboard shows customers' phone numbers.
- Free plans have limits. Check Supabase and Vercel pricing pages if traffic grows.

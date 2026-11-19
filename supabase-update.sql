-- Run this ONCE in Supabase (SQL Editor) if you already created the table
-- from the first version. It adds the "order total" column used by the dashboard.
alter table discount_codes add column if not exists order_amount numeric;

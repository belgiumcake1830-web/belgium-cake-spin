-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run
create table if not exists discount_codes (
  id bigint generated always as identity primary key,
  code text unique not null,
  phone text not null,
  percent int not null check (percent between 1 and 20),
  days_ahead int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  used_channel text,
  order_amount numeric
);

create index if not exists discount_codes_phone_created
  on discount_codes (phone, created_at);

-- Lock the table: only the server (service key) can read/write it.
alter table discount_codes enable row level security;

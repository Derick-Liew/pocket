-- 钱包 Pocket — run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Every table is private to the signed-in user (row level security).

create or replace function pocket_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table if not exists accounts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name_zh text not null, name_en text not null,
  currency text not null default 'MYR',
  kind text not null check (kind in ('spend','save','protected')),
  opening numeric not null default 0,
  opening_set boolean not null default false,
  sort int not null default 0,
  archived boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists categories (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  kind text not null check (kind in ('expense','income')),
  name_zh text not null, name_en text not null,
  icon text not null default '•',
  budget numeric not null default 0,          -- monthly, in main currency
  sort int not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists debts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name_zh text not null, name_en text not null,
  currency text not null default 'MYR',
  start_balance numeric not null default 0,
  planned_monthly numeric not null default 0,
  interest text not null default '',
  note text not null default '',
  sort int not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists entries (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  kind text not null check (kind in ('income','expense','transfer','debt','borrow')),
  amount numeric not null,                     -- in `currency`
  currency text not null,
  account_id text,                             -- money comes from / goes into this account
  to_account_id text,                          -- transfer target
  to_amount numeric,                           -- transfer: amount landing in target account currency
  category_id text,
  debt_id text,
  note text not null default '',
  src text not null default 'phone',
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists gigs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  client text not null, job text not null,
  price numeric not null, currency text not null default 'MYR',
  status text not null default 'quoted',
  note text not null default '',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists wishes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  item text not null,
  price numeric not null, currency text not null default 'MYR',
  category_id text,
  recheck date,
  decision text not null default 'waiting',
  note text not null default '',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- One row per day: units of each currency per 1 USD, as fetched that day. Entries convert with their date's row.
create table if not exists fx_rates (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,                            -- the day, YYYY-MM-DD
  rates jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists settings (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null default 'main',
  main_currency text not null default 'MYR',
  lang text not null default 'zh',
  last_account_id text,
  recent_currencies jsonb not null default '[]',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','debts','entries','gigs','wishes','fx_rates','settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own on %I', t);
    execute format('create policy own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('drop trigger if exists touch on %I', t);
    execute format('create trigger touch before insert or update on %I for each row execute function pocket_touch()', t);
    execute format('create index if not exists %I on %I (user_id, updated_at)', t || '_updated', t);
  end loop;
end $$;

-- 钱包 Pocket phase 2: fixed monthly items (reminders only — the app asks, you tap to log).
-- Run once in Supabase: SQL Editor → New query → paste → Run.

create table if not exists recurring (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  kind text not null check (kind in ('income','expense','debt','transfer')),
  name_zh text not null, name_en text not null,
  amount numeric not null,
  currency text not null default 'MYR',
  day int not null default 1 check (day between 1 and 31),   -- day of month it is due
  account_id text,
  to_account_id text,
  category_id text,
  debt_id text,
  last_done text,                                             -- YYYY-MM of the last month logged or skipped
  sort int not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table recurring enable row level security;
drop policy if exists own on recurring;
create policy own on recurring for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists touch on recurring;
create trigger touch before insert or update on recurring for each row execute function pocket_touch();
create index if not exists recurring_updated on recurring (user_id, updated_at);

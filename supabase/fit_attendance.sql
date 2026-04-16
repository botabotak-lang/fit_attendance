-- fit-attendance 用テーブル（Supabase SQL Editor で1回実行）
-- 修理アプリ（ship-repair）の customers / employees とは別。勤怠は全社員、修理はエンジニア向けなど別マスタ。
-- RLS 有効・ポリシーなし = anon はアクセス不可。アプリは service_role のみ Route Handler 経由で操作。

create table if not exists public.fit_attendance_punches (
  id text primary key,
  employee text not null,
  punch_type text not null check (punch_type in ('clock_in', 'clock_out', 'go_out', 'go_back')),
  timestamp_text text not null,
  punch_date date not null
);

create index if not exists fit_attendance_punches_date_idx
  on public.fit_attendance_punches (punch_date);
create index if not exists fit_attendance_punches_employee_idx
  on public.fit_attendance_punches (employee);
create index if not exists fit_attendance_punches_ts_text_idx
  on public.fit_attendance_punches (timestamp_text);

alter table public.fit_attendance_punches enable row level security;

create table if not exists public.fit_attendance_employees (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fit_attendance_employees_sort_idx
  on public.fit_attendance_employees (sort_order);

alter table public.fit_attendance_employees enable row level security;

-- 勤怠アプリ用（全社員）。修理アプリの社員・顧客マスタとは別定義。
insert into public.fit_attendance_employees (name, sort_order) values
  ('鈴木', 0),
  ('大竹', 1),
  ('森田', 2),
  ('深田', 3),
  ('石橋', 4),
  ('豊島', 5)
on conflict (name) do nothing;

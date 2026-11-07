create type report_issue_type as enum (
  'wrong_price',
  'permanently_closed',
  'wrong_location',
  'unsafe',
  'other'
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_name text,
  reported_value text,
  issue_type report_issue_type not null,
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

create policy "Users can read own reports"
  on reports for select
  using (auth.uid() = user_id);
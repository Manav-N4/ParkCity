create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  push_token text,
  reporter_trust_level integer not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);
create table parking_sessions (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  duration_minutes integer,
  estimated_cost numeric,
  reminder_minutes_before integer
);

alter table parking_sessions enable row level security;

create policy "Users can manage own sessions"
  on parking_sessions for all
  using (auth.uid() = user_id);
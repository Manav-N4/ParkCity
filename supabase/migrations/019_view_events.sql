create table view_events (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  user_id uuid references auth.users(id),
  viewed_at timestamptz not null default now()
);
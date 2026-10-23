create table navigation_events (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  user_id uuid,
  navigated_at timestamptz not null default now()
);
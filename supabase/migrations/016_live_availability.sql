create table live_availability (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  available_count integer not null default 0,
  total_count integer not null default 0,
  last_updated_at timestamptz not null default now(),
  last_updated_by uuid references auth.users(id),
  constraint available_lte_total check (available_count <= total_count),
  constraint available_gte_zero check (available_count >= 0)
);

alter table live_availability enable row level security;

create policy "Anyone can read availability"
  on live_availability for select
  using (true);
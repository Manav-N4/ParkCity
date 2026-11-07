create table saved_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null references parking_spots(id) on delete cascade,
  saved_at timestamptz not null default now(),
  constraint saved_spots_user_spot_key unique (user_id, spot_id)
);

alter table saved_spots enable row level security;

create policy "Users can manage own saved spots"
  on saved_spots for all
  using (auth.uid() = user_id);
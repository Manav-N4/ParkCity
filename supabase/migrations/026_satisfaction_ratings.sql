create table satisfaction_ratings (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references parking_sessions(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  submitted_at timestamptz not null default now(),
  constraint one_rating_per_session unique (session_id)
);

alter table satisfaction_ratings enable row level security;

create policy "Users can manage own ratings"
  on satisfaction_ratings for all
  using (auth.uid() = user_id);
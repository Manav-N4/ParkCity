create table owner_pending (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references parking_spots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ownership_details jsonb not null default '{}',
  photo_urls text[] not null default '{}',
  geotag_flagged boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table owner_pending enable row level security;

create policy "Owners can read own submissions"
  on owner_pending for select
  using (auth.uid() = user_id);
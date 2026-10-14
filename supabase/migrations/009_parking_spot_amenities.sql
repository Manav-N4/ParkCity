create table if not exists public.parking_spot_amenities_cache (
  spot_id uuid not null references public.parking_spots(id) on delete cascade,
  amenities jsonb,
  last_fetched_at timestamptz not null default now(),
  cache_invalidated_at timestamptz default null,
  primary key (spot_id)
);
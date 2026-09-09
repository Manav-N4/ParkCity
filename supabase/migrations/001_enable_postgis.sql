create extension if not exists postgis;
create table parking_spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  price_per_hour numeric(10,2),
  google_place_id text,
  source text default 'google_raw',
  location geography(point, 4326) not null,
  created_at timestamptz default now()
);
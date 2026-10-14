create type public.attribute_source as enum (
  'field_verified',
  'owner_verified',
  'crowd_verified',
  'google_raw'
);

create table if not exists public.parking_spot_attributes (
  spot_id uuid not null references public.parking_spots(id) on delete cascade,
  field_name text not null,
  value text not null,
  source public.attribute_source not null,
  suppressed boolean not null default false,
  last_updated_at timestamptz not null default now(),

  primary key (spot_id, field_name, source)
);
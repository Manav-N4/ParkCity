create function get_parking_spots_by_ids(spot_uuids uuid[])
returns table (
  id uuid,
  name text,
  address text,
  price_per_hour numeric,
  google_place_id text,
  source text,
  created_at timestamptz,
  lat double precision,
  lng double precision
)
language sql
as $$
  select
    ps.id,
    ps.name,
    ps.address,
    ps.price_per_hour,
    ps.google_place_id,
    ps.source,
    ps.created_at,
    ST_Y(ps.location::geometry) as lat,
    ST_X(ps.location::geometry) as lng
  from parking_spots ps
  where ps.id = any(spot_uuids)
$$;
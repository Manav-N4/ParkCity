drop function if exists get_parking_spot_detail(uuid);

create function get_parking_spot_detail(spot_uuid uuid)
returns table (
  id uuid,
  name text,
  address text,
  price_per_hour numeric,
  google_place_id text,
  source text,
  location geography,
  created_at timestamptz,
  lat double precision,
  lng double precision,
  available_count integer,
  total_count integer,
  availability_updated_at timestamptz,
  availability_status text
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
    ps.location,
    ps.created_at,
    ST_Y(ps.location::geometry) as lat,
    ST_X(ps.location::geometry) as lng,
    la.available_count,
    la.total_count,
    la.last_updated_at as availability_updated_at,
    case
      when la.last_updated_at is null then 'unconfirmed'
      when la.last_updated_at > now() - interval '30 minutes' then 'live'
      when la.last_updated_at > now() - interval '4 hours' then 'stale'
      else 'unconfirmed'
    end as availability_status
  from parking_spots ps
  left join live_availability la on la.spot_id = ps.id
  where ps.id = spot_uuid
$$;
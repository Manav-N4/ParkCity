CREATE OR REPLACE FUNCTION public.nearby_parking_spots(
  user_lng double precision,
  user_lat double precision,
  radius_meters double precision DEFAULT 2000
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  price_per_hour numeric,
  source text,
  distance_meters double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH user_point AS (
    SELECT ST_GeogFromText(
      'SRID=4326;POINT(' || user_lng || ' ' || user_lat || ')'
    ) AS pt
  )
  SELECT
    p.id,
    p.name,
    p.address,
    p.price_per_hour,
    p.source,
    ST_Distance(p.location, u.pt) AS distance_meters
  FROM public.parking_spots AS p
  CROSS JOIN user_point AS u
  WHERE ST_DWithin(p.location, u.pt, radius_meters)
  ORDER BY distance_meters ASC;
$$;
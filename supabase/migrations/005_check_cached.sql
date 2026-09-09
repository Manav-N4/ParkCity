create or replace function public.check_cached(
input_geohash text
)
Returns uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    cached_spots 
  FROM public.cached_parking_spots AS p
  WHERE input_geohash = geohash
  AND last_fetched_at >= NOW() - INTERVAL '30 days'
$$;
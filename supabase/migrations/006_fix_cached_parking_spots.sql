ALTER TABLE public.cached_parking_spots
DROP column c_id,
ADD CONSTRAINT cached_parking_spots_pkey PRIMARY KEY (geohash),
ADD COLUMN geohash_precision smallint,
ALTER COLUMN cached_spots TYPE jsonb USING cached_spots::text::jsonb;
DROP FUNCTION IF EXISTS public.check_cached(text);
create or replace function public.check_cached(
input_geohash text
)
Returns jsonb
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
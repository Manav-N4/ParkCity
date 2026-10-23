DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parking_spots_google_place_id_key'
      AND conrelid = 'public.parking_spots'::regclass
  ) THEN
    ALTER TABLE public.parking_spots
    ADD CONSTRAINT parking_spots_google_place_id_key
    UNIQUE (google_place_id);
  END IF;
END
$$;
ALTER TABLE public.parking_spots
ADD CONSTRAINT parking_spots_google_place_id_key UNIQUE (google_place_id);
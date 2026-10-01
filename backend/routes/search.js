const express = require('express')
const router = express.Router()
const { encode } = require('geohash-kit')
const supabase = require('../supabase')

router.post('/', async (req, res) => {
  try {
    const { lat, lng } = req.body        
    const hash = encode(lat, lng, 6)
    const { data, error } = await supabase
        .from("cached_parking_spots")
        .select("cached_spots")
        .eq("geohash", hash)
        .gte(
          "last_fetched_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        );
      if (error) throw error;
      if (data && data.length > 0) {
        return res.json(data[0].cached_spots);
      } else {
        const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
        const result = await fetch(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=parking&key=${API_KEY}`,
        );
        const final = await result.json();
        console.log(JSON.stringify(final));
        const spots = final.results.map((place) => ({
          google_place_id: place.place_id,
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          source: "google_raw",
        }));
        await supabase
          .from("cached_parking_spots")
          .upsert({
            geohash: hash,
            geohash_precision: 6,
            cached_spots: spots,
            last_fetched_at: new Date().toISOString(),
          });
        const { error: upsertError } = await supabase
          .from("parking_spots")
          .upsert(
            spots.map((spot) => ({
              name: spot.name,
              google_place_id: spot.google_place_id,
              source: "google_raw",
              location: `SRID=4326;POINT(${spot.lng} ${spot.lat})`,
            })),
            { onConflict: "google_place_id" },
          );
        if (upsertError) {
          console.log(
            "parking_spots upsert error:",
            JSON.stringify(upsertError),
          );
        }
        return res.json(spots);
      }                       
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
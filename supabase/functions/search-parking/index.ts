import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { encode } from "https://esm.sh/geohash-kit";
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { lat, lng } = await req.json();
      const hash = encode(lat, lng, 6);
      const { data, error } = await ctx.supabaseAdmin
        .from("cached_parking_spots")
        .select("cached_spots")
        .eq("geohash", hash)
        .gte(
          "last_fetched_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        );
      if (error) throw error;
      if (data && data.length > 0) {
        return Response.json(data[0].cached_spots);
      } else {
        const API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=parking&key=${API_KEY}`,
        );
        const final = await res.json();
        console.log(JSON.stringify(final));
        const spots = final.results.map((place) => ({
          google_place_id: place.place_id,
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          source: "google_raw",
        }));
        await ctx.supabaseAdmin
          .from("cached_parking_spots")
          .upsert({
            geohash: hash,
            geohash_precision: 6,
            cached_spots: spots,
            last_fetched_at: new Date().toISOString(),
          });
        const { error: upsertError } = await ctx.supabaseAdmin
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
        return Response.json(spots);
      }
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }),
};

const express = require('express')
const router = express.Router()
const { encode } = require('geohash-kit')
const supabase = require('../supabase')

async function mergePrices(spots) {
  if (!spots || spots.length === 0) return []

  const placeIds = spots
    .map((spot) => spot.google_place_id)
    .filter(Boolean)

  if (placeIds.length === 0) {
    return spots.map((spot) => ({
      ...spot,
      price_per_hour: spot.price_per_hour ?? null,
    }))
  }

  const { data: pricedSpots, error: priceError } = await supabase
    .from('parking_spots')
    .select('google_place_id, price_per_hour')
    .in('google_place_id', placeIds)

  if (priceError) {
    console.log('price lookup error:', JSON.stringify(priceError))

    return spots.map((spot) => ({
      ...spot,
      price_per_hour: spot.price_per_hour ?? null,
    }))
  }

  const priceByPlaceId = new Map(
    (pricedSpots || []).map((spot) => [
      spot.google_place_id,
      spot.price_per_hour,
    ])
  )

  return spots.map((spot) => ({
    ...spot,
    price_per_hour:
    priceByPlaceId.get(spot.google_place_id) ??
    spot.price_per_hour ??
    null,
  }))
}

router.post('/', async (req, res) => {
  try {
    const { lat, lng } = req.body
    const hash = encode(lat, lng, 6)

    const { data, error } = await supabase
      .from('cached_parking_spots')
      .select('cached_spots')
      .eq('geohash', hash)
      .gte(
        'last_fetched_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      )

    if (error) throw error

    if (data && data.length > 0) {
      const cachedSpots = data[0].cached_spots || []
      const mergedCachedSpots = await mergePrices(cachedSpots)

      return res.json(mergedCachedSpots)
    }

    const API_KEY = process.env.GOOGLE_PLACES_API_KEY

    const result = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=parking&key=${API_KEY}`,
    )

    const final = await result.json()

    if (final.status !== 'OK' && final.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places error: ${final.status}`)
    }

    console.log(JSON.stringify(final))

    const spots = (final.results || []).map((place) => ({
      google_place_id: place.place_id,
      name: place.name,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      source: 'google_raw',
    }))

    const spotsWithPrices = await mergePrices(spots)

    await supabase.from('cached_parking_spots').upsert({
      geohash: hash,
      geohash_precision: 6,
      cached_spots: spotsWithPrices,
      last_fetched_at: new Date().toISOString(),
    })

    const { error: upsertError } = await supabase
      .from('parking_spots')
      .upsert(
        spotsWithPrices.map(({ price_per_hour, ...spot }) => ({
          ...spot,
          ...(price_per_hour != null ? { price_per_hour } : {}),
          location: `SRID=4326;POINT(${spot.lng} ${spot.lat})`,
        })),
        { onConflict: 'google_place_id' },
      )

    if (upsertError) {
      console.log(
        'parking_spots upsert error:',
        JSON.stringify(upsertError),
      )
    }

    return res.json(spotsWithPrices)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
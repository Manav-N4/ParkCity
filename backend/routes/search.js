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
      id: spot.id ?? null,
      price_per_hour: spot.price_per_hour ?? null,
    }))
  }

  const { data: pricedSpots, error: priceError } = await supabase
    .from('parking_spots')
    .select('id, google_place_id, price_per_hour')
    .in('google_place_id', placeIds)

  if (priceError) {
    console.log('price lookup error:', JSON.stringify(priceError))

    return spots.map((spot) => ({
      ...spot,
      id: spot.id ?? null,
      price_per_hour: spot.price_per_hour ?? null,
    }))
  }

  const spotByPlaceId = new Map(
    (pricedSpots || []).map((spot) => [
      spot.google_place_id,
      {
        id: spot.id,
        price_per_hour: spot.price_per_hour,
      },
    ])
  )

  return spots.map((spot) => {
    const dbSpot = spotByPlaceId.get(spot.google_place_id)

    return {
      ...spot,
      id: spot.id ?? dbSpot?.id ?? null,
      price_per_hour:
        dbSpot?.price_per_hour ??
        spot.price_per_hour ??
        null,
    }
  })
}


const SOURCE_PRECEDENCE = [
  'field_verified',
  'owner_verified',
  'crowd_verified',
  'google_raw',
]


async function resolveAttributes(spotId) {
  const { data, error } = await supabase
    .from('parking_spot_attributes')
    .select('field_name, value, source, suppressed')
    .eq('spot_id', spotId)

  if (error) throw error

  const grouped = new Map()

  for (const row of data || []) {
    if (row.suppressed) continue

    const rank = SOURCE_PRECEDENCE.indexOf(row.source)
    if (rank === -1) continue

    const existing = grouped.get(row.field_name)

    if (!existing || rank < existing.rank) {
      grouped.set(row.field_name, {
        value: row.value,
        source: row.source,
        rank,
      })
    }
  }

  const attributes = {}

  for (const [fieldName, resolved] of grouped.entries()) {
    attributes[fieldName] = {
      value: resolved.value,
      source: resolved.source,
    }
  }

  return attributes
}


function getSpotCoordinates(spot) {
  if (
    spot.location &&
    Array.isArray(spot.location.coordinates) &&
    spot.location.coordinates.length === 2
  ) {
    return {
      lng: spot.location.coordinates[0],
      lat: spot.location.coordinates[1],
    }
  }

  if (typeof spot.lat === 'number' && typeof spot.lng === 'number') {
    return {
      lat: spot.lat,
      lng: spot.lng,
    }
  }

  if (
    typeof spot.latitude === 'number' &&
    typeof spot.longitude === 'number'
  ) {
    return {
      lat: spot.latitude,
      lng: spot.longitude,
    }
  }

  return {
    lat: null,
    lng: null,
  }
}


async function getAmenities(spot) {
  const { data: cache, error: cacheError } = await supabase
    .from('parking_spot_amenities_cache')
    .select('amenities, last_fetched_at, cache_invalidated_at')
    .eq('spot_id', spot.id)
    .maybeSingle()

  if (cacheError) throw cacheError

  const cacheIsFresh =
    cache?.amenities &&
    (
      !cache.cache_invalidated_at ||
      new Date(cache.last_fetched_at) > new Date(cache.cache_invalidated_at)
    )

  if (cacheIsFresh) {
    return cache.amenities
  }

  const amenities = await fetchGoogleAmenities(spot)

  const { error: upsertError } = await supabase
    .from('parking_spot_amenities_cache')
    .upsert(
      {
        spot_id: spot.id,
        amenities,
        last_fetched_at: new Date().toISOString(),
        cache_invalidated_at: cache?.cache_invalidated_at ?? null,
      },
      { onConflict: 'spot_id' },
    )

  if (upsertError) {
    console.error('amenities cache upsert error:', upsertError)
  }

  return amenities
}


const AMENITY_SEARCHES = [
  {
    key: 'petrol_bunk',
    type: 'gas_station',
  },
  {
    key: 'ev_charging',
    type: 'electric_vehicle_charging_station',
  },
  {
    key: 'car_wash',
    type: 'car_wash',
  },
]


async function fetchGoogleAmenities(spot) {
  const { lat, lng } = getSpotCoordinates(spot)

  if (!lat || !lng) {
    return {
      petrol_bunk: false,
      ev_charging: false,
      car_wash: false,
    }
  }

  const results = await Promise.all(
    AMENITY_SEARCHES.map(async (amenity) => {
      const url = new URL(
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
      )

      url.searchParams.set('location', `${lat},${lng}`)
      url.searchParams.set('radius', '500')
      url.searchParams.set('type', amenity.type)
      url.searchParams.set('key', process.env.GOOGLE_PLACES_API_KEY)

      const response = await fetch(url.toString())
      const data = await response.json()

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(
          `Google Places error for ${amenity.type}: ${data.status}`
        )
      }

      return {
        key: amenity.key,
        available: (data.results || []).length > 0,
      }
    })
  )

  return results.reduce((acc, result) => {
    acc[result.key] = result.available
    return acc
  }, {})
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
        spotsWithPrices.map(
          ({ id, price_per_hour, ...spot }) => ({
            ...spot,
            ...(price_per_hour != null ? { price_per_hour } : {}),
            location: `SRID=4326;POINT(${spot.lng} ${spot.lat})`,
          })
        ),
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


router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data: spot, error: spotError } = await supabase
  .rpc('get_parking_spot_detail', {
    spot_uuid: id,
  })
  .maybeSingle()

    if (spotError || !spot) {
      return res.status(404).json({ error: 'Parking spot not found' })
    }

    const attributes = await resolveAttributes(id)
    const amenities = await getAmenities(spot)

    return res.json({
      ...spot,
      attributes,
      amenities,
    })
  } catch (error) {
    console.error('spot detail error:', error)
    return res.status(500).json({ error: error.message })
  }
})


module.exports = router
// Street View photos for parking spots.
//
// Places photos are user uploads (selfies, people posing with cars), so the
// spot photo now comes from the Street View Static API, looked up by the
// spot's lat/lng. Nothing photo-related is stored: every lookup starts from
// coordinates we already keep and the result goes straight to the client.
//
// Lookups:
//   1. Street View metadata (free, not billed) to check coverage and get the
//      pano id and its position.
//   2. If status is OK, build the Static API image URL. The image is billed
//      when the client loads it, so the daily budget is consumed here.
//
// source=outdoor limits results to Google's own outdoor imagery and excludes
// user-contributed photospheres. The heading points the camera from the pano
// towards the spot instead of a random direction.
//
// The Static API only accepts the key as a query parameter, so the returned
// image URL contains it. Use a dedicated STREETVIEW_API_KEY restricted to
// "Street View Static API" only (falls back to GOOGLE_PLACES_API_KEY).
// Never log these URLs.

const STREETVIEW_BASE = 'https://maps.googleapis.com/maps/api/streetview'
const UPSTREAM_TIMEOUT_MS = 5000
const SIZES = { 400: '400x240', 800: '800x480' }
const NO_COVERAGE_STATUSES = new Set(['ZERO_RESULTS', 'NOT_FOUND'])

function photoError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function apiKey() {
  return process.env.STREETVIEW_API_KEY || process.env.GOOGLE_PLACES_API_KEY
}

function publicBaseUrl() {
  const raw = process.env.PUBLIC_API_BASE_URL
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin + url.pathname.replace(/\/+$/, '')
  } catch {
    return null
  }
}

// Stable, keyless lookup URL for a spot, or null when the feature is not
// configured. Street View needs only coordinates, so every spot qualifies;
// the route returns { photo: null } where there is no coverage.
function photoLookupUrl(spot) {
  const base = publicBaseUrl()
  if (!base || !spot?.id) return null
  return `${base}/spot-photo/${encodeURIComponent(spot.id)}`
}

// Adds photo_lookup_url to a spot object without changing anything else.
function withPhotoLookup(spot) {
  if (!spot || typeof spot !== 'object') return spot
  return { ...spot, photo_lookup_url: photoLookupUrl(spot) }
}

// Compass bearing in degrees (0-359) from point A to point B.
function bearing(fromLat, fromLng, toLat, toLng) {
  const rad = (d) => (d * Math.PI) / 180
  const dLng = rad(toLng - fromLng)
  const y = Math.sin(dLng) * Math.cos(rad(toLat))
  const x =
    Math.cos(rad(fromLat)) * Math.sin(rad(toLat)) -
    Math.sin(rad(fromLat)) * Math.cos(rad(toLat)) * Math.cos(dLng)
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
}

async function fetchMetadata(lat, lng) {
  const url = new URL(`${STREETVIEW_BASE}/metadata`)
  url.searchParams.set('location', `${lat},${lng}`)
  url.searchParams.set('radius', '50')
  url.searchParams.set('source', 'outdoor')
  url.searchParams.set('key', apiKey())

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    return await response.json()
  } catch (error) {
    // Network failure, timeout or bad JSON. Never log the URL (it holds the key).
    throw photoError('PHOTO_UPSTREAM_ERROR', `Street View request failed: ${error.name}`)
  }
}

// Returns a SpotPhoto for the coordinates, or null when there is no imagery.
// beforeBilledCall() must return false to stop (budget exhausted).
async function lookupPhoto(lat, lng, width, beforeBilledCall) {
  const meta = await fetchMetadata(lat, lng)

  if (meta?.status !== 'OK' || typeof meta.pano_id !== 'string') {
    // No coverage is normal. Anything else (REQUEST_DENIED, OVER_QUERY_LIMIT)
    // also yields the placeholder, but is logged so a bad key is not silent.
    if (!NO_COVERAGE_STATUSES.has(meta?.status)) {
      console.error('street view metadata status:', meta?.status)
    }
    return null
  }

  if (!beforeBilledCall()) {
    throw photoError('PHOTO_BUDGET_EXCEEDED', 'Photo budget exhausted for today')
  }

  const size = SIZES[width]
  const [w, h] = size.split('x').map(Number)

  const image = new URL(STREETVIEW_BASE)
  image.searchParams.set('size', size)
  image.searchParams.set('pano', meta.pano_id)
  image.searchParams.set('fov', '90')
  image.searchParams.set('pitch', '0')
  if (typeof meta.location?.lat === 'number' && typeof meta.location?.lng === 'number') {
    image.searchParams.set('heading', String(bearing(meta.location.lat, meta.location.lng, lat, lng)))
  }
  image.searchParams.set('key', apiKey())

  return {
    uri: image.href,
    width_px: w,
    height_px: h,
    attributions: [],
    google_maps_uri: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    flag_content_uri: null,
  }
}

// Concurrent identical requests share one upstream call. The entry is
// removed as soon as the call settles, so nothing is retained.
const inFlight = new Map()

function fetchStreetViewPhoto(lat, lng, width, beforeBilledCall) {
  const key = `${lat},${lng}:${width}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = lookupPhoto(lat, lng, width, beforeBilledCall).finally(() => {
    inFlight.delete(key)
  })

  inFlight.set(key, promise)
  return promise
}

module.exports = {
  photoLookupUrl,
  withPhotoLookup,
  fetchStreetViewPhoto,
}

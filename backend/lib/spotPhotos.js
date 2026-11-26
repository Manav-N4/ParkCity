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
// source=google limits results to official Google collections and excludes
// user-contributed panoramas. The heading points the camera from the pano
// towards the spot instead of a random direction.
//
// The Static API only accepts the key as a query parameter, so the returned
// image URL contains it. It must be a dedicated STREETVIEW_API_KEY restricted
// to "Street View Static API" only, and every URL is signed with
// STREETVIEW_URL_SIGNING_SECRET (which never leaves the server). With the
// "unsigned requests" quota set to 0 in Google Cloud, a leaked URL cannot be
// altered or reused to request other images. There is no fallback key: if
// either variable is missing the feature is off. Never log these URLs.

const crypto = require('crypto')

const STREETVIEW_BASE = 'https://maps.googleapis.com/maps/api/streetview'
const UPSTREAM_TIMEOUT_MS = 5000
// The Static API caps images at 640x640.
const SIZES = { 400: '400x240', 800: '640x384' }
const NO_COVERAGE_STATUSES = new Set(['ZERO_RESULTS', 'NOT_FOUND'])
const DEFAULT_ATTRIBUTION = 'Google'

function photoError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

// Google's "modified Base64 for URLs": standard alphabet with + -> - and
// / -> _, padding kept (unlike Node's 'base64url', which strips it).
function decodeSigningSecret(secret) {
  const decoded = Buffer.from(secret.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  return decoded.length > 0 ? decoded : null
}

// { key, secret } when both env vars are set and the secret is valid,
// otherwise null (feature off).
function streetViewConfig() {
  const key = process.env.STREETVIEW_API_KEY
  const rawSecret = process.env.STREETVIEW_URL_SIGNING_SECRET
  if (!key || !rawSecret) return null
  const secret = decodeSigningSecret(rawSecret)
  return secret ? { key, secret } : null
}

// Signs a request URL per Google's URL signing algorithm: HMAC-SHA1 over the
// path and query, keyed with the decoded secret, appended as &signature=.
function signUrl(url, secret) {
  const toSign = `${url.pathname}${url.search}`
  const signature = crypto
    .createHmac('sha1', secret)
    .update(toSign)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${url.href}&signature=${signature}`
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
  if (!base || !streetViewConfig() || !spot?.id) return null
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

async function fetchMetadata(config, lat, lng) {
  const url = new URL(`${STREETVIEW_BASE}/metadata`)
  url.searchParams.set('location', `${lat},${lng}`)
  url.searchParams.set('radius', '50')
  url.searchParams.set('source', 'google')
  url.searchParams.set('key', config.key)

  try {
    const response = await fetch(signUrl(url, config.secret), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    return await response.json()
  } catch (error) {
    // Network failure, timeout or bad JSON. Never log the URL (it holds the key).
    throw photoError('PHOTO_UPSTREAM_ERROR', `Street View request failed: ${error.name}`)
  }
}

function attributionFrom(meta) {
  const copyright =
    typeof meta.copyright === 'string' && meta.copyright.trim()
      ? meta.copyright.trim()
      : DEFAULT_ATTRIBUTION
  return [{ display_name: copyright, uri: null, photo_uri: null }]
}

// Returns a SpotPhoto for the coordinates, or null when there is no imagery.
// Decisions use the metadata JSON "status", not the HTTP status.
// beforeBilledCall() must return false to stop (budget exhausted).
async function lookupPhoto(lat, lng, width, beforeBilledCall) {
  const config = streetViewConfig()
  if (!config) {
    throw photoError('PHOTO_NOT_CONFIGURED', 'Street View is not configured')
  }

  const meta = await fetchMetadata(config, lat, lng)
  const status = meta?.status

  // No coverage is normal: the app shows its placeholder.
  if (NO_COVERAGE_STATUSES.has(status)) return null

  // Anything else that isn't a usable OK (OVER_QUERY_LIMIT, REQUEST_DENIED,
  // INVALID_REQUEST, UNKNOWN_ERROR, missing status, OK without a pano) is an
  // upstream failure, so a bad key or exhausted quota is never silent.
  if (status !== 'OK' || typeof meta.pano_id !== 'string' || !meta.pano_id) {
    console.error('street view metadata status:', typeof status === 'string' ? status : 'missing')
    throw photoError('PHOTO_UPSTREAM_ERROR', 'Street View metadata unavailable')
  }

  if (!beforeBilledCall()) {
    throw photoError('PHOTO_BUDGET_EXCEEDED', 'Photo budget exhausted for today')
  }

  const size = SIZES[width] ?? SIZES[400]
  const [w, h] = size.split('x').map(Number)

  const image = new URL(STREETVIEW_BASE)
  image.searchParams.set('size', size)
  image.searchParams.set('pano', meta.pano_id)
  image.searchParams.set('fov', '90')
  image.searchParams.set('pitch', '0')
  if (typeof meta.location?.lat === 'number' && typeof meta.location?.lng === 'number') {
    image.searchParams.set('heading', String(bearing(meta.location.lat, meta.location.lng, lat, lng)))
  }
  image.searchParams.set('source', 'google')
  // Error code instead of a generic gray image if imagery disappears.
  image.searchParams.set('return_error_code', 'true')
  image.searchParams.set('key', config.key)

  return {
    uri: signUrl(image, config.secret),
    width_px: w,
    height_px: h,
    attributions: attributionFrom(meta),
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
  streetViewConfig,
  signUrl,
}

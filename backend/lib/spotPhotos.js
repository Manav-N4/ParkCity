// Google Places photos for parking spots.
//
// Google's terms forbid caching photo references/names (they also expire),
// so nothing photo-related is stored: every lookup starts from the
// google_place_id we already keep (place IDs are exempt from caching
// restrictions) and the result is handed straight to the client.
//
// Lookups use Places API (New):
//   1. Place Details with field mask "photos" (Essentials IDs Only SKU)
//   2. Place Photo media with skipHttpRedirect=true (billed per call)
// The API key is only ever sent in the X-Goog-Api-Key header.

const PLACES_BASE = 'https://places.googleapis.com/v1'
const UPSTREAM_TIMEOUT_MS = 5000
const PHOTO_NAME_PATTERN = /^places\/[^/?#]+\/photos\/[^/?#]+$/

function photoError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
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

// Stable, keyless lookup URL for a spot, or null when no photo can exist
// (no id, no google_place_id) or the feature is not configured.
function photoLookupUrl(spot) {
  const base = publicBaseUrl()
  if (!base || !spot?.id || !spot?.google_place_id) return null
  return `${base}/spot-photo/${encodeURIComponent(spot.id)}`
}

// Adds photo_lookup_url to a spot object without changing anything else.
function withPhotoLookup(spot) {
  if (!spot || typeof spot !== 'object') return spot
  return { ...spot, photo_lookup_url: photoLookupUrl(spot) }
}

function httpsOrNull(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// Keeps every attribution entry, in order, as plain data (never HTML).
function normalizeAttributions(list) {
  if (!Array.isArray(list)) return []
  return list.map((entry) => ({
    display_name:
      typeof entry?.displayName === 'string' && entry.displayName.trim()
        ? entry.displayName.trim()
        : null,
    uri: httpsOrNull(entry?.uri),
    photo_uri: httpsOrNull(entry?.photoUri),
  }))
}

async function googleGet(url, headers) {
  let response
  try {
    response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        ...headers,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    // Network failure or timeout. Never log the request (headers hold the key).
    throw photoError('PHOTO_UPSTREAM_ERROR', `Google request failed: ${error.name}`)
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  return { status: response.status, body }
}

// Returns a fresh photo for the place, or null when it has none.
// beforeBilledCall() is invoked right before the billed media request and
// must return false to stop it (budget exhausted).
async function lookupPhoto(placeId, width, beforeBilledCall) {
  const details = await googleGet(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
    { 'X-Goog-FieldMask': 'photos' },
  )

  // Unknown or obsolete place IDs simply have no photo for us.
  if (details.status === 404 || details.status === 400) return null

  if (details.status !== 200) {
    console.error('places details (photos) error status:', details.status)
    throw photoError('PHOTO_UPSTREAM_ERROR', 'Google Places lookup failed')
  }

  const photo = Array.isArray(details.body?.photos) ? details.body.photos[0] : null
  if (!photo || typeof photo.name !== 'string' || !PHOTO_NAME_PATTERN.test(photo.name)) {
    return null
  }

  if (!beforeBilledCall()) {
    throw photoError('PHOTO_BUDGET_EXCEEDED', 'Photo budget exhausted for today')
  }

  const media = await googleGet(
    `${PLACES_BASE}/${photo.name}/media?maxWidthPx=${width}&skipHttpRedirect=true`,
    {},
  )

  if (media.status !== 200) {
    console.error('places photo media error status:', media.status)
    throw photoError('PHOTO_UPSTREAM_ERROR', 'Google Places photo failed')
  }

  const uri = httpsOrNull(media.body?.photoUri)
  if (!uri) {
    throw photoError('PHOTO_UPSTREAM_ERROR', 'Google Places photo returned no image')
  }

  const originalWidth = Number(photo.widthPx) || null
  const originalHeight = Number(photo.heightPx) || null
  const scale =
    originalWidth && originalWidth > width ? width / originalWidth : 1

  return {
    uri,
    width_px: originalWidth ? Math.round(originalWidth * scale) : null,
    height_px: originalHeight ? Math.round(originalHeight * scale) : null,
    attributions: normalizeAttributions(photo.authorAttributions),
    google_maps_uri: httpsOrNull(photo.googleMapsUri),
    flag_content_uri: httpsOrNull(photo.flagContentUri),
  }
}

// Concurrent identical requests share one upstream call. The entry is
// removed as soon as the call settles, so nothing is retained.
const inFlight = new Map()

function fetchFreshSpotPhoto(placeId, width, beforeBilledCall) {
  const key = `${placeId}:${width}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = lookupPhoto(placeId, width, beforeBilledCall).finally(() => {
    inFlight.delete(key)
  })

  inFlight.set(key, promise)
  return promise
}

module.exports = {
  photoLookupUrl,
  withPhotoLookup,
  normalizeAttributions,
  fetchFreshSpotPhoto,
}

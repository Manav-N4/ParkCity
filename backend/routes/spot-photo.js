const express = require('express')
const router = express.Router()
const supabase = require('../supabase')
const { fetchStreetViewPhoto } = require('../lib/spotPhotos')
const {
  createRateLimiter,
  createConcurrencyGate,
  createDailyBudget,
} = require('../lib/limits')

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_WIDTHS = new Set([400, 800])
const DEFAULT_WIDTH = 400

const dailyLimit = Number.parseInt(process.env.PHOTO_DAILY_LIMIT ?? '', 10)

const perUserLimit = createRateLimiter({ limit: 60, windowMs: 60 * 1000 })
const upstreamGate = createConcurrencyGate(8)
const dailyBudget = createDailyBudget(
  Number.isFinite(dailyLimit) && dailyLimit >= 0 ? dailyLimit : 1000,
)

// GET /spot-photo/:spotId?w=400|800
// Returns a Street View photo for the spot as JSON. Nothing is cached:
// the response is no-store and the backend keeps no photo data.
router.get('/:spotId', async (req, res) => {
  res.set('Cache-Control', 'no-store')

  const { spotId } = req.params
  if (!UUID_PATTERN.test(spotId)) {
    return res.status(400).json({ error: 'Invalid spot id', code: 'VALIDATION_ERROR' })
  }

  const width = req.query.w === undefined ? DEFAULT_WIDTH : Number(req.query.w)
  if (!ALLOWED_WIDTHS.has(width)) {
    return res.status(400).json({ error: 'w must be 400 or 800', code: 'VALIDATION_ERROR' })
  }

  if (!perUserLimit(req.user.id)) {
    return res.status(429).json({ error: 'Too many photo requests', code: 'RATE_LIMITED' })
  }

  try {
    const { data: spot, error } = await supabase
      .rpc('get_parking_spot_detail', { spot_uuid: spotId })
      .maybeSingle()

    if (error) {
      console.error('db error:', error)
      throw new Error('Something went wrong')
    }

    if (!spot) {
      return res.status(404).json({ error: 'Parking spot not found', code: 'NOT_FOUND' })
    }

    if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') {
      return res.json({ photo: null })
    }

    if (!upstreamGate.tryAcquire()) {
      return res.status(503).json({ error: 'Photo service busy', code: 'PHOTO_BUSY' })
    }

    let photo
    try {
      photo = await fetchStreetViewPhoto(spot.lat, spot.lng, width, () =>
        dailyBudget.tryConsume(),
      )
    } finally {
      upstreamGate.release()
    }

    return res.json({ photo })
  } catch (error) {
    if (error.code === 'PHOTO_BUDGET_EXCEEDED') {
      return res.status(503).json({ error: error.message, code: error.code })
    }
    if (error.code === 'PHOTO_UPSTREAM_ERROR') {
      return res.status(502).json({ error: 'Photo unavailable', code: error.code })
    }
    console.error('spot photo error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router

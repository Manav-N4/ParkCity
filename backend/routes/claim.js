const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

const MAX_GEOTAG_DISTANCE_METERS = 500

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

router.post('/', async (req, res) => {
  try {
    const user_id = req.user.id
    const {
      spot_id,
      ownership_details,
      photo_urls,
      photo_lat,
      photo_lng,
      price_per_hour,
      operating_hours,
      capacity,
    } = req.body

    if (!spot_id || !photo_urls || photo_urls.length < 3) {
      return res.status(400).json({ error: 'spot_id and 3 photo_urls are required' })
    }

    // geotag cross-check
    const { data: spot, error: spotError } = await supabase
      .rpc('get_parking_spot_detail', { spot_uuid: spot_id })
      .maybeSingle()

    if (spotError || !spot) {
      return res.status(404).json({ error: 'Spot not found' })
    }

    let geotag_flagged = false
    if (photo_lat && photo_lng && spot.lat && spot.lng) {
      const distance = haversineDistance(photo_lat, photo_lng, spot.lat, spot.lng)
      geotag_flagged = distance > MAX_GEOTAG_DISTANCE_METERS
    }

    // write owner_pending row
    const { error: claimError } = await supabase
      .from('owner_pending')
      .insert({
        spot_id,
        user_id,
        ownership_details: ownership_details ?? {},
        photo_urls,
        geotag_flagged,
      })

    if (claimError) throw claimError

    // write attribute rows as owner_pending source
    const attributeRows = []
    if (price_per_hour != null) {
      attributeRows.push({ spot_id, field_name: 'price_per_hour', value: String(price_per_hour), source: 'owner_pending' })
    }
    if (operating_hours) {
      attributeRows.push({ spot_id, field_name: 'operating_hours', value: operating_hours, source: 'owner_pending' })
    }
    if (capacity != null) {
      attributeRows.push({ spot_id, field_name: 'capacity', value: String(capacity), source: 'owner_pending' })
    }

    if (attributeRows.length > 0) {
      const { error: attrError } = await supabase
        .from('parking_spot_attributes')
        .insert(attributeRows)
      if (attrError) throw attrError
    }

    return res.json({ success: true, geotag_flagged })
  } catch (error) {
    console.error('claim error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
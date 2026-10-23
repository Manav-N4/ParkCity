const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/', async (req, res) => {
  try {
    const user_id = req.user.id
    const {
      name,
      address,
      lat,
      lng,
      price_per_hour,
      operating_hours,
      capacity,
      photo_urls,
    } = req.body

    if (!name || !lat || !lng) {
      return res.status(400).json({ error: 'name, lat, and lng are required' })
    }

    if (!photo_urls || photo_urls.length < 1) {
      return res.status(400).json({ error: 'At least one photo is required' })
    }

    // insert new parking_spots row
    const { data: spot, error: spotError } = await supabase
      .from('parking_spots')
      .insert({
        name,
        address: address ?? null,
        source: 'owner_pending',
        location: `SRID=4326;POINT(${lng} ${lat})`,
      })
      .select('id')
      .single()

    if (spotError) throw spotError

    const spot_id = spot.id

    // write attribute rows
    const attributeRows = []
    if (price_per_hour != null) {
      attributeRows.push({ spot_id, field_name: 'price_per_hour', value: String(price_per_hour), source: 'owner_created' })
    }
    if (operating_hours) {
      attributeRows.push({ spot_id, field_name: 'operating_hours', value: operating_hours, source: 'owner_created' })
    }
    if (capacity != null) {
      attributeRows.push({ spot_id, field_name: 'capacity', value: String(capacity), source: 'owner_created' })
    }

    if (attributeRows.length > 0) {
      const { error: attrError } = await supabase
        .from('parking_spot_attributes')
        .insert(attributeRows)
      if (attrError) throw attrError
    }

    // write to owner_pending for admin review
    const { error: pendingError } = await supabase
      .from('owner_pending')
      .insert({
        spot_id,
        user_id,
        ownership_details: { name, address },
        photo_urls,
        geotag_flagged: false,
      })

    if (pendingError) throw pendingError

    return res.json({ success: true, spot_id })
  } catch (error) {
    console.error('create listing error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
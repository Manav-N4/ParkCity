const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

const GEOFENCE_RADIUS_METERS = 500

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

router.post('/checkin', async (req, res) => {
  try {
    const user_id = req.user.id
    const { spot_id, user_lat, user_lng } = req.body

    if (!spot_id || user_lat == null || user_lng == null) {
      return res.status(400).json({ error: 'spot_id, user_lat, and user_lng are required' })
    }

    // get spot coordinates
    const { data: spot, error: spotError } = await supabase
      .rpc('get_parking_spot_detail', { spot_uuid: spot_id })
      .maybeSingle()

    if (spotError || !spot) {
      return res.status(404).json({ error: 'Spot not found' })
    }

    // geofence check
    const distance = haversineDistance(user_lat, user_lng, spot.lat, spot.lng)
    if (distance > GEOFENCE_RADIUS_METERS) {
      return res.status(403).json({ error: `You must be within 500m of the spot to check in. You are ${Math.round(distance)}m away.` })
    }

    // check for existing active session
    const { data: existing, error: existingError } = await supabase
      .from('parking_sessions')
      .select('id')
      .eq('user_id', user_id)
      .is('checked_out_at', null)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      return res.status(409).json({ error: 'You already have an active parking session' })
    }

    const { data: session, error: insertError } = await supabase
      .from('parking_sessions')
      .insert({ spot_id, user_id })
      .select('id, checked_in_at')
      .single()

    if (insertError) throw insertError

    return res.json({ success: true, session_id: session.id, checked_in_at: session.checked_in_at })
  } catch (error) {
    console.error('checkin error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.post('/checkout', async (req, res) => {
  try {
    const user_id = req.user.id
    const { session_id } = req.body

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' })
    }

    // fetch session
    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .select('*, parking_spots(price_per_hour)')
      .eq('id', session_id)
      .eq('user_id', user_id)
      .is('checked_out_at', null)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!session) {
      return res.status(404).json({ error: 'Active session not found' })
    }

    const checkedOutAt = new Date()
    const checkedInAt = new Date(session.checked_in_at)
    const duration_minutes = Math.round((checkedOutAt - checkedInAt) / 60000)

    const pricePerHour = session.parking_spots?.price_per_hour ?? null
    const estimated_cost = pricePerHour
      ? parseFloat(((duration_minutes / 60) * pricePerHour).toFixed(2))
      : null

    const { error: updateError } = await supabase
      .from('parking_sessions')
      .update({
        checked_out_at: checkedOutAt.toISOString(),
        duration_minutes,
        estimated_cost,
      })
      .eq('id', session_id)

    if (updateError) throw updateError

    return res.json({ success: true, duration_minutes, estimated_cost })
  } catch (error) {
    console.error('checkout error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.get('/history', async (req, res) => {
  try {
    const user_id = req.user.id

    const { data, error } = await supabase
      .from('parking_sessions')
      .select('*, parking_spots(name, address)')
      .eq('user_id', user_id)
      .order('checked_in_at', { ascending: false })

    if (error) throw error

    return res.json(data || [])
  } catch (error) {
    console.error('sessions history error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_HOURS = 24

router.post('/', async (req, res) => {
  try {
    const user_id = req.user.id
    const { spot_id, issue_type, field_name, reported_value, photo_url } = req.body

    if (!spot_id || !issue_type) {
      return res.status(400).json({ error: 'spot_id and issue_type are required' })
    }

    // rate limit check
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', windowStart)

    if (countError) throw countError

    if (count >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'Report limit reached. Try again tomorrow.' })
    }

    // insert report
    const { error: insertError } = await supabase
      .from('reports')
      .insert({ spot_id, user_id, issue_type, field_name, reported_value, photo_url })

    if (insertError) throw insertError

    // auto-promotion check — 3 agreeing reports on same spot + field = crowd_verified
    if (field_name && reported_value) {
      const { count: agreeCount, error: agreeError } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('spot_id', spot_id)
        .eq('field_name', field_name)
        .eq('reported_value', reported_value)
        .eq('status', 'pending')

      if (agreeError) throw agreeError

      if (agreeCount >= 3) {
        // write crowd_verified attribute row
        const { error: attrError } = await supabase
          .from('parking_spot_attributes')
          .insert({
            spot_id,
            field_name,
            value: reported_value,
            source: 'crowd_verified',
          })

        if (attrError) throw attrError

        // invalidate amenities cache for this spot
        const { error: cacheError } = await supabase
          .from('parking_spot_amenities_cache')
          .update({ cache_invalidated_at: new Date().toISOString() })
          .eq('spot_id', spot_id)

        if (cacheError) throw cacheError
      }
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('report submission error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
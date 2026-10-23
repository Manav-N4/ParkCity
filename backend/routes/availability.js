const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/update', async (req, res) => {
  try {
    const user_id = req.user.id
    const { spot_id, available_count, total_count } = req.body

    if (!spot_id || available_count == null || total_count == null) {
      return res.status(400).json({ error: 'spot_id, available_count, and total_count are required' })
    }

    if (available_count < 0 || available_count > total_count) {
      return res.status(400).json({ error: 'available_count must be between 0 and total_count' })
    }

    // verify the requesting user owns this spot
    const { data: ownership, error: ownerError } = await supabase
      .from('owner_pending')
      .select('id')
      .eq('spot_id', spot_id)
      .eq('user_id', user_id)
      .eq('status', 'approved')
      .maybeSingle()

    if (ownerError) throw ownerError

    if (!ownership) {
      return res.status(403).json({ error: 'You do not own this spot' })
    }

    const { error } = await supabase
      .from('live_availability')
      .upsert(
        {
          spot_id,
          available_count,
          total_count,
          last_updated_at: new Date().toISOString(),
          last_updated_by: user_id,
        },
        { onConflict: 'spot_id' }
      )

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('availability update error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
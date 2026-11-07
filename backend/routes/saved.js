const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/toggle', async (req, res) => {
  try {
    const user_id = req.user.id
    const { spot_id, action } = req.body

    if (!spot_id || !action || !['save', 'unsave'].includes(action)) {
      return res.status(400).json({ error: 'spot_id and action (save/unsave) are required' })
    }

    if (action === 'save') {
      const { error } = await supabase
        .from('saved_spots')
        .insert({ user_id, spot_id })

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('saved_spots')
        .delete()
        .eq('user_id', user_id)
        .eq('spot_id', spot_id)

      if (error) throw error
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('save toggle error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const user_id = req.user.id

    const { data: savedRows, error: savedError } = await supabase
      .from('saved_spots')
      .select('spot_id, saved_at')
      .eq('user_id', user_id)
      .order('saved_at', { ascending: false })

    if (savedError) throw savedError

    if (!savedRows || savedRows.length === 0) {
      return res.json([])
    }

    const spotIds = savedRows.map((r) => r.spot_id)

    const { data: spots, error: spotsError } = await supabase
      .rpc('get_parking_spots_by_ids', { spot_uuids: spotIds })

    if (spotsError) throw spotsError

    return res.json(spots || [])
  } catch (error) {
    console.error('saved spots fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
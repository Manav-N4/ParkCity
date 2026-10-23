const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/', async (req, res) => {
  try {
    const { spot_id } = req.body
    const user_id = req.user.id

    if (!spot_id) {
      return res.status(400).json({ error: 'spot_id is required' })
    }

    const { error } = await supabase
      .from('navigation_events')
      .insert({ spot_id, user_id })

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('navigation log error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
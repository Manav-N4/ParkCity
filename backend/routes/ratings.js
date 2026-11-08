const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/', async (req, res) => {
  try {
    const user_id = req.user.id
    const { spot_id, session_id, rating, comment } = req.body

    if (!spot_id || !session_id || rating == null) {
      return res.status(400).json({ error: 'spot_id, session_id, and rating are required' })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' })
    }

    // verify session belongs to this user
    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (sessionError) throw sessionError
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const { error } = await supabase
      .from('satisfaction_ratings')
      .insert({ spot_id, user_id, session_id, rating, comment: comment ?? null })

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('rating submission error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
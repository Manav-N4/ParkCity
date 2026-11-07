const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/token', async (req, res) => {
  try {
    const user_id = req.user.id
    const { push_token } = req.body

    if (!push_token) {
      return res.status(400).json({ error: 'push_token is required' })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ push_token })
      .eq('id', user_id)

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('push token error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.post('/set', async (req, res) => {
  try {
    const user_id = req.user.id
    const { session_id, reminder_minutes_before } = req.body

    if (!session_id || reminder_minutes_before == null) {
      return res.status(400).json({ error: 'session_id and reminder_minutes_before are required' })
    }

    // verify session belongs to this user
    const { data: session, error: sessionError } = await supabase
      .from('parking_sessions')
      .select('id, user_id')
      .eq('id', session_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (sessionError) throw sessionError

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const { error } = await supabase
      .from('parking_sessions')
      .update({ reminder_minutes_before })
      .eq('id', session_id)

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('set reminder error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
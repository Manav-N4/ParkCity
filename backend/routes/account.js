const express = require('express')
const router = express.Router()
const supabase = require('../supabase')
const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

router.delete('/delete', async (req, res) => {
  try {
    const user_id = req.user.id

    // anonymise reports and deal_redemptions
    await supabase.from('reports').update({ user_id: null }).eq('user_id', user_id)
    await supabase.from('deal_redemptions').update({ user_id: null }).eq('user_id', user_id)

    // cascade delete personal data
    await supabase.from('satisfaction_ratings').delete().eq('user_id', user_id)
    await supabase.from('parking_sessions').delete().eq('user_id', user_id)
    await supabase.from('saved_spots').delete().eq('user_id', user_id)
    await supabase.from('profiles').delete().eq('id', user_id)

    // delete auth user — requires service role key
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (authError) throw authError

    return res.json({ success: true })
  } catch (error) {
    console.error('account deletion error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.get('/export', async (req, res) => {
  try {
    const user_id = req.user.id

    const [profile, savedSpots, sessions, ratings] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user_id).single(),
      supabase.from('saved_spots').select('*').eq('user_id', user_id),
      supabase.from('parking_sessions').select('*').eq('user_id', user_id),
      supabase.from('satisfaction_ratings').select('*').eq('user_id', user_id),
    ])

    return res.json({
      profile: profile.data ?? null,
      saved_spots: savedSpots.data ?? [],
      parking_sessions: sessions.data ?? [],
      satisfaction_ratings: ratings.data ?? [],
    })
  } catch (error) {
    console.error('data export error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
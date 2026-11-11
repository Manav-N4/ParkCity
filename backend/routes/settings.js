const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/notifications', async (req, res) => {
  try {
    const user_id = req.user.id
    const { reminders_enabled, satisfaction_prompts_enabled } = req.body

    if (reminders_enabled == null && satisfaction_prompts_enabled == null) {
      return res.status(400).json({ error: 'At least one preference is required' })
    }

    const updates = {}
    if (reminders_enabled != null) updates.reminders_enabled = reminders_enabled
    if (satisfaction_prompts_enabled != null) updates.satisfaction_prompts_enabled = satisfaction_prompts_enabled

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user_id)

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('notification prefs error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
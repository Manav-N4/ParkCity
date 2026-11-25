const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/upsert', async (req, res) => {
  try {
    // Identity comes from the verified token; any body user_id is ignored.
    const user_id = req.user.id
    const { name, email } = req.body ?? {}

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user_id, name, email }, { onConflict: 'id' })

    if (error) {
      console.error('db error:', error)
      throw new Error('Something went wrong')
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('profile upsert error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.get('/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params

    // Users may only read their own profile.
    if (user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, phone, avatar_url, created_at')
      .eq('id', user_id)
      .maybeSingle()

    if (error) {
      console.error('db error:', error)
      throw new Error('Something went wrong')
    }

    return res.json(data ?? null)
  } catch (error) {
    console.error('profile fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
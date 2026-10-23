const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/upsert', async (req, res) => {
  try {
    const { user_id, name, email } = req.body

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' })
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user_id, name, email }, { onConflict: 'id' })

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('profile upsert error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.get('/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .eq('id', user_id)
      .maybeSingle()

    if (error) throw error

    return res.json(data ?? null)
  } catch (error) {
    console.error('profile fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
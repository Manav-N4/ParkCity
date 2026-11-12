const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.get('/:spot_id', async (req, res) => {
  try {
    const { spot_id } = req.params
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('deals')
      .select('id, offer_text, discount_label, redemption_code_prefix, valid_until')
      .contains('parking_spot_ids', [spot_id])
      .lte('valid_from', now)
      .gte('valid_until', now)

    if (error) {
      console.error('db error:', error)
      throw new Error('Something went wrong')
    }

    return res.json(data || [])
  } catch (error) {
    console.error('deals fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.post('/redeem', async (req, res) => {
  try {
    const user_id = req.user.id
    const { deal_id, spot_id } = req.body

    if (!deal_id || !spot_id) {
      return res.status(400).json({ error: 'deal_id and spot_id are required' })
    }

    // verify deal is still active
    const now = new Date().toISOString()
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, redemption_code_prefix')
      .eq('id', deal_id)
      .lte('valid_from', now)
      .gte('valid_until', now)
      .maybeSingle()

    if (dealError) {
      console.error('db error:', dealError)
      throw new Error('Something went wrong')
    }
    if (!deal) return res.status(404).json({ error: 'Deal not found or expired' })

    // generate unique code server-side
    const redemption_code = `${deal.redemption_code_prefix}-${user_id.slice(0, 6).toUpperCase()}`

    const { error: insertError } = await supabase
      .from('deal_redemptions')
      .insert({ deal_id, user_id, spot_id, redemption_code })

    if (insertError) {
      console.error('db error:', insertError)
      throw new Error('Something went wrong')
    }

    return res.json({ success: true, redemption_code })
  } catch (error) {
    console.error('deal redemption error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const supabase = require('../supabase')

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature']
    const body = JSON.stringify(req.body)

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    if (req.body.event === 'payment_link.paid') {
      const notes = req.body.payload.payment_link.entity.notes
      const { merchant_id, spot_id } = notes

      await supabase
        .from('sponsored_spots')
        .update({ monthly_fee_paid: true })
        .eq('spot_id', spot_id)
        .eq('merchant_id', merchant_id)
    }

    return res.json({ success: true })
  } catch (error) {
    console.error('webhook error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
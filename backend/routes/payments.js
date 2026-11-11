const express = require('express')
const router = express.Router()
const Razorpay = require('razorpay')
const crypto = require('crypto')
const supabase = require('../supabase')

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

router.post('/create-link', async (req, res) => {
  try {
    const { merchant_id, spot_id, amount } = req.body

    if (!merchant_id || !spot_id || !amount) {
      return res.status(400).json({ error: 'merchant_id, spot_id, and amount are required' })
    }

    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100, // razorpay uses paise
      currency: 'INR',
      description: `Park City sponsored slot — spot ${spot_id}`,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { merchant_id, spot_id },
    })

    return res.json({ success: true, payment_link: paymentLink.short_url, payment_link_id: paymentLink.id })
  } catch (error) {
    console.error('payment link error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
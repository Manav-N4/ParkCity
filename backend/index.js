const express = require('express');
const app = express();

require('dotenv').config()

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_PLACES_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
]

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const requireAuth = require('./middleware/auth')
app.use(express.json());

const autocompleteRouter = require('./routes/autocomplete')
app.use('/autocomplete', autocompleteRouter)

const searchRouter = require('./routes/search')
app.use('/search', searchRouter)

const placeDetailsRouter = require('./routes/place-details')
app.use('/place-details', placeDetailsRouter)

const navigationRouter = require('./routes/navigation')
app.use('/navigation-log', requireAuth, navigationRouter)

const profileListingsRouter = require('./routes/profile-listings')
app.use('/profile', requireAuth, profileListingsRouter)

const profileRouter = require('./routes/profile')
app.use('/profile', requireAuth, profileRouter)

const claimRouter = require('./routes/claim')
app.use('/claim', requireAuth, claimRouter)

const listingRouter = require('./routes/listing')
app.use('/listing', requireAuth, listingRouter)

const availabilityRouter = require('./routes/availability')
app.use('/availability', requireAuth, availabilityRouter)

const statsRouter = require('./routes/stats')
app.use('/stats', requireAuth, statsRouter)

const reportsRouter = require('./routes/reports')
app.use('/reports', requireAuth, reportsRouter)

const adminRouter = require('./routes/admin')
app.use('/admin', requireAuth, adminRouter)

const savedRouter = require('./routes/saved')
app.use('/saved', requireAuth, savedRouter)

const sessionsRouter = require('./routes/sessions')
app.use('/sessions', requireAuth, sessionsRouter)

const spendRouter = require('./routes/spend')
app.use('/spend', requireAuth, spendRouter)

const remindersRouter = require('./routes/reminders')
app.use('/reminders', requireAuth, remindersRouter)

const ratingsRouter = require('./routes/ratings')
app.use('/ratings', requireAuth, ratingsRouter)

const dealsRouter = require('./routes/deals')
app.use('/deals', requireAuth, dealsRouter)

const paymentsRouter = require('./routes/payments')
const webhookRouter = require('./routes/webhook')

const settingsRouter = require('./routes/settings')
app.use('/settings', requireAuth, settingsRouter)

app.use('/payments', requireAuth, paymentsRouter)
app.use('/razorpay-webhook', webhookRouter)

const accountRouter = require('./routes/account')
app.use('/account', requireAuth, accountRouter)

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

const errorHandler = require('./middleware/errorHandler')
app.use(errorHandler)

app.listen(3000);
const express = require('express');
const app = express();

require('dotenv').config()

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

app.use('/payments', requireAuth, paymentsRouter)
app.use('/razorpay-webhook', webhookRouter)

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.listen(3000);
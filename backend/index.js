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

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.listen(3000);
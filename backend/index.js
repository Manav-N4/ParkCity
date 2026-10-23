const express = require('express');
const app = express();

require('dotenv').config()

const supabase = require('./supabase')
app.use(express.json());

const autocompleteRouter = require('./routes/autocomplete')
app.use('/autocomplete', autocompleteRouter)

const searchRouter = require('./routes/search')
app.use('/search', searchRouter)

const placeDetailsRouter = require('./routes/place-details')
app.use('/place-details', placeDetailsRouter)

const navigationRouter = require('./routes/navigation')
app.use('/navigation-log', navigationRouter)

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.listen(3000);
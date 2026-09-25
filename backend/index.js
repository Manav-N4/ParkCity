const express = require('express');
const app = express();

require('dotenv').config()

const supabase = require('./supabase')
app.use(express.json());

const searchRouter = require('./routes/search')
app.use('/search', searchRouter)

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.listen(3000);
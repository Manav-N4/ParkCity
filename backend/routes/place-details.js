const express = require('express')
const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const {place_id, sessiontoken} = req.body        
        const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
        const result = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&sessiontoken=${sessiontoken}&key=${API_KEY}`,
        );
        const final = await result.json();
        const { lat, lng } = final.result.geometry.location
        return res.json({ lat, lng })                      
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
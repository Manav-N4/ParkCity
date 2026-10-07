const express = require('express')
const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const { input, sessiontoken } = req.body        
        const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
        const result = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&sessiontoken=${sessiontoken}&key=${API_KEY}`,
        );
        const final = await result.json();
        console.log(JSON.stringify(final));
        const suggestions = final.predictions.map((place) => ({
          google_place_id: place.place_id,
          description: place.description,
        }));
        return res.json(suggestions);                      
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
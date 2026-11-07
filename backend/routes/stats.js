const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

// called every time any user opens a spot detail screen
router.post('/view', async (req, res) => {
  try {
    const user_id = req.user.id
    const { spot_id } = req.body

    if (!spot_id) {
      return res.status(400).json({ error: 'spot_id is required' })
    }

    const { error } = await supabase
      .from('view_events')
      .insert({ spot_id, user_id })

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('view log error:', error)
    return res.status(500).json({ error: error.message })
  }
})

// owner stats — returns aggregated views, navigations, deal redemptions per spot
router.get('/owner', async (req, res) => {
  try {
    const user_id = req.user.id

    // get all spot_ids owned by this user
    const { data: ownedSpots, error: ownerError } = await supabase
      .from('owner_pending')
      .select('spot_id')
      .eq('user_id', user_id)
      .eq('status', 'approved')

    if (ownerError) throw ownerError

    if (!ownedSpots || ownedSpots.length === 0) {
      return res.json([])
    }

    const spotIds = ownedSpots.map((r) => r.spot_id)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // views this month
    const { data: views, error: viewError } = await supabase
      .from('view_events')
      .select('spot_id')
      .in('spot_id', spotIds)
      .gte('viewed_at', startOfMonth)

    if (viewError) throw viewError

    // navigations this month
    const { data: navigations, error: navError } = await supabase
      .from('navigation_events')
      .select('spot_id')
      .in('spot_id', spotIds)
      .gte('navigated_at', startOfMonth)

    if (navError) throw navError

    // aggregate per spot
    const statsMap = {}
    for (const id of spotIds) {
      statsMap[id] = { spot_id: id, views: 0, navigations: 0 }
    }

    for (const v of views || []) {
      if (statsMap[v.spot_id]) statsMap[v.spot_id].views++
    }

    for (const n of navigations || []) {
      if (statsMap[n.spot_id]) statsMap[n.spot_id].navigations++
    }

    return res.json(Object.values(statsMap))
  } catch (error) {
    console.error('owner stats error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
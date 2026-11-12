const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.get('/', async (req, res) => {
  try {
    const user_id = req.user.id

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

    const { data: sessions, error } = await supabase
      .from('parking_sessions')
      .select('estimated_cost, checked_in_at, parking_spots(address)')
      .eq('user_id', user_id)
      .not('checked_out_at', 'is', null)
      .gte('checked_in_at', startOfLastMonth)

    if (error) {
      console.error('db error:', error)
      throw new Error('Something went wrong')
    }

    const thisMonthSessions = sessions.filter(s => s.checked_in_at >= startOfMonth)
    const lastMonthSessions = sessions.filter(s => s.checked_in_at < startOfMonth)

    const totalThisMonth = thisMonthSessions.reduce((sum, s) => sum + (s.estimated_cost || 0), 0)
    const totalLastMonth = lastMonthSessions.reduce((sum, s) => sum + (s.estimated_cost || 0), 0)

    // area breakdown — group by address
    const areaMap = {}
    for (const s of thisMonthSessions) {
      const area = s.parking_spots?.address || 'Unknown area'
      if (!areaMap[area]) areaMap[area] = { sessions: 0, total: 0 }
      areaMap[area].sessions++
      areaMap[area].total += s.estimated_cost || 0
    }

    const areaBreakdown = Object.entries(areaMap).map(([area, data]) => ({
      area,
      sessions: data.sessions,
      total: parseFloat(data.total.toFixed(2)),
    }))

    return res.json({
      total_this_month: parseFloat(totalThisMonth.toFixed(2)),
      sessions_this_month: thisMonthSessions.length,
      total_last_month: parseFloat(totalLastMonth.toFixed(2)),
      month_over_month_diff: parseFloat((totalThisMonth - totalLastMonth).toFixed(2)),
      area_breakdown: areaBreakdown,
    })
  } catch (error) {
    console.error('spend summary error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
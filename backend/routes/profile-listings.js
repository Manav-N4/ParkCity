const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.get('/listings', async (req, res) => {
  try {
    const user_id = req.user.id

    const { data: ownedSpots, error: ownerError } = await supabase
      .from('owner_pending')
      .select('spot_id, status')
      .eq('user_id', user_id)

    if (ownerError) throw ownerError

    if (!ownedSpots || ownedSpots.length === 0) {
      return res.json([])
    }

    const spotIds = ownedSpots.map((r) => r.spot_id)
    const statusMap = Object.fromEntries(ownedSpots.map((r) => [r.spot_id, r.status]))

    const { data: spots, error: spotsError } = await supabase
      .rpc('get_parking_spots_by_ids', { spot_uuids: spotIds })

    if (spotsError) throw spotsError

    const { data: attributes, error: attrError } = await supabase
      .from('parking_spot_attributes')
      .select('spot_id, field_name, value, source, suppressed')
      .in('spot_id', spotIds)

    if (attrError) throw attrError

    const SOURCE_PRECEDENCE = ['field_verified', 'owner_verified', 'crowd_verified', 'google_raw']

    const verificationMap = {}
    for (const row of attributes || []) {
      if (row.suppressed) continue
      const rank = SOURCE_PRECEDENCE.indexOf(row.source)
      if (rank === -1) continue
      const existing = verificationMap[row.spot_id]
      if (!existing || rank < existing.rank) {
        verificationMap[row.spot_id] = { source: row.source, rank }
      }
    }

    const result = (spots || []).map((spot) => ({
      ...spot,
      ownership_status: statusMap[spot.id] ?? 'pending',
      verification_tier: verificationMap[spot.id]?.source ?? 'unverified',
    }))

    return res.json(result)
  } catch (error) {
    console.error('my listings error:', error)
    return res.status(500).json({ error: error.message })
  }
})

router.post('/update', async (req, res) => {
  try {
    const user_id = req.user.id
    const { name, avatar_url } = req.body

    if (!name && !avatar_url) {
      return res.status(400).json({ error: 'name or avatar_url is required' })
    }

    const updates = {}
    if (name) updates.name = name
    if (avatar_url) updates.avatar_url = avatar_url

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user_id)

    if (error) throw error

    return res.json({ success: true })
  } catch (error) {
    console.error('profile update error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
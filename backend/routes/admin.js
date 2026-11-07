const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

router.post('/correct', async (req, res) => {
  try {
    const { report_id, action } = req.body

    if (!report_id || !action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'report_id and action (accept/reject) are required' })
    }

    // fetch the report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', report_id)
      .single()

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' })
    }

    if (action === 'reject') {
      await supabase
        .from('reports')
        .update({ status: 'rejected' })
        .eq('id', report_id)

      return res.json({ success: true, action: 'rejected' })
    }

    // accept — suppress old attribute rows for this field, write corrected value
    if (report.field_name && report.reported_value) {
      const now = new Date().toISOString()

      // suppress existing attribute rows for this field on this spot
      const { error: suppressError } = await supabase
        .from('parking_spot_attributes')
        .update({ suppressed: true, suppressed_at: now })
        .eq('spot_id', report.spot_id)
        .eq('field_name', report.field_name)
        .eq('suppressed', false)

      if (suppressError) throw suppressError

      // write corrected value as crowd_verified
      const { error: attrError } = await supabase
        .from('parking_spot_attributes')
        .insert({
          spot_id: report.spot_id,
          field_name: report.field_name,
          value: report.reported_value,
          source: 'crowd_verified',
        })

      if (attrError) throw attrError

      // invalidate caches
      await supabase
        .from('parking_spot_amenities_cache')
        .update({ cache_invalidated_at: now })
        .eq('spot_id', report.spot_id)

      await supabase
        .from('cached_parking_spots')
        .update({ last_fetched_at: new Date(0).toISOString() })
        .eq('geohash', report.spot_id)
    }

    // mark report accepted
    await supabase
      .from('reports')
      .update({ status: 'accepted' })
      .eq('id', report_id)

    return res.json({ success: true, action: 'accepted' })
  } catch (error) {
    console.error('admin correction error:', error)
    return res.status(500).json({ error: error.message })
  }
})

module.exports = router
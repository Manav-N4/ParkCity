const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

// Identity always comes from the verified token (req.user.id).
// Any user_id sent by the client is ignored.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VEHICLE_NUMBER_PATTERN = /^[A-Z0-9]{4,12}$/
const NAME_MAX = 100
const ADDRESS_MAX = 300
const ONBOARDING_MAX_VEHICLES = 3

const PROFILE_COLUMNS =
  'id, name, email, address, avatar_url, onboarding_completed, created_at'
const VEHICLE_COLUMNS = 'id, vehicle_number, is_primary, created_at'

class RequestError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const validationError = (message) =>
  new RequestError(400, 'VALIDATION_ERROR', message)

// Uppercase and strip spaces, hyphens and dots ("ka-01 ab.1234" -> "KA01AB1234").
function normalizeVehicleNumber(value) {
  if (typeof value !== 'string') return null
  const normalized = value.toUpperCase().replace(/[\s.-]/g, '')
  return VEHICLE_NUMBER_PATTERN.test(normalized) ? normalized : null
}

function parseName(value) {
  if (typeof value !== 'string') throw validationError('name must be a string')
  const name = value.trim()
  if (name.length < 1 || name.length > NAME_MAX) {
    throw validationError(`name must be 1 to ${NAME_MAX} characters`)
  }
  return name
}

// undefined = not provided, null = clear.
function parseAddress(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw validationError('address must be a string')
  const address = value.trim()
  if (address.length === 0) return null
  if (address.length > ADDRESS_MAX) {
    throw validationError(`address must be at most ${ADDRESS_MAX} characters`)
  }
  return address
}

function publicVehicle(row) {
  return {
    id: row.id,
    vehicle_number: row.vehicle_number,
    is_primary: row.is_primary,
    created_at: row.created_at,
  }
}

// Maps database errors (including exceptions raised by the vehicle
// functions in migration 033) to API errors.
function fromDbError(error) {
  const message = error?.message ?? ''
  if (message.includes('VEHICLE_EXISTS') || error?.code === '23505') {
    return new RequestError(409, 'VEHICLE_EXISTS', 'This vehicle is already saved')
  }
  if (message.includes('VEHICLE_LIMIT')) {
    return new RequestError(409, 'VEHICLE_LIMIT', 'You can save up to 5 vehicles')
  }
  if (message.includes('VEHICLE_NOT_FOUND')) {
    return new RequestError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found')
  }
  if (message.includes('VALIDATION_ERROR') || error?.code === '23514') {
    return validationError('Invalid profile or vehicle data')
  }
  console.error('db error:', error)
  return new RequestError(500, 'INTERNAL_ERROR', 'Something went wrong')
}

function sendError(res, error, label) {
  if (error instanceof RequestError) {
    return res.status(error.status).json({ error: error.message, code: error.code })
  }
  console.error(`${label} error:`, error)
  return res.status(500).json({ error: 'Something went wrong', code: 'INTERNAL_ERROR' })
}

function nameFromMetadata(metadata) {
  const raw = metadata?.full_name ?? metadata?.name
  if (typeof raw !== 'string') return null
  const name = raw.trim().slice(0, NAME_MAX)
  return name.length > 0 ? name : null
}

// Creates the profile row if it does not exist yet; never overwrites.
async function ensureProfile(user) {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        name: nameFromMetadata(user.user_metadata),
        email: user.email ?? null,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
  if (error) throw fromDbError(error)
}

async function loadVehicles(userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw fromDbError(error)
  return (data || []).map(publicVehicle)
}

async function loadProfile(userId) {
  const [profileResult, vehicles] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle(),
    loadVehicles(userId),
  ])
  if (profileResult.error) throw fromDbError(profileResult.error)
  if (!profileResult.data) {
    throw new RequestError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
  }
  return { ...profileResult.data, vehicles }
}

async function callVehicleFunction(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw fromDbError(error)
  return { vehicles: (data || []).map(publicVehicle) }
}

// GET /user/profile
router.get('/profile', async (req, res) => {
  try {
    await ensureProfile(req.user)
    return res.json(await loadProfile(req.user.id))
  } catch (error) {
    return sendError(res, error, 'user profile fetch')
  }
})

// PATCH /user/profile  { name?, address? }
router.patch('/profile', async (req, res) => {
  try {
    const body = req.body ?? {}
    const updates = {}
    if (body.name !== undefined) updates.name = parseName(body.name)
    const address = parseAddress(body.address)
    if (address !== undefined) updates.address = address

    if (Object.keys(updates).length === 0) {
      throw validationError('name or address is required')
    }

    await ensureProfile(req.user)

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
    if (error) throw fromDbError(error)

    return res.json(await loadProfile(req.user.id))
  } catch (error) {
    return sendError(res, error, 'user profile update')
  }
})

// POST /user/onboarding  { name, address?, vehicles: string[] }
router.post('/onboarding', async (req, res) => {
  try {
    const body = req.body ?? {}
    const name = parseName(body.name)
    const address = parseAddress(body.address) ?? null

    if (!Array.isArray(body.vehicles) || body.vehicles.length === 0) {
      throw validationError('At least one vehicle is required')
    }

    const vehicleNumbers = []
    for (const raw of body.vehicles) {
      const number = normalizeVehicleNumber(raw)
      if (!number) {
        throw validationError(
          'Vehicle numbers must be 4 to 12 letters or digits',
        )
      }
      if (!vehicleNumbers.includes(number)) vehicleNumbers.push(number)
    }

    if (vehicleNumbers.length > ONBOARDING_MAX_VEHICLES) {
      throw validationError(
        `You can add up to ${ONBOARDING_MAX_VEHICLES} vehicles during onboarding`,
      )
    }

    // Single transaction in the database; safe to retry.
    const { error } = await supabase.rpc('complete_onboarding', {
      p_user_id: req.user.id,
      p_name: name,
      p_address: address,
      p_vehicle_numbers: vehicleNumbers,
    })
    if (error) throw fromDbError(error)

    return res.json(await loadProfile(req.user.id))
  } catch (error) {
    return sendError(res, error, 'onboarding')
  }
})

// POST /user/vehicles  { vehicle_number, is_primary? }
router.post('/vehicles', async (req, res) => {
  try {
    const body = req.body ?? {}
    const number = normalizeVehicleNumber(body.vehicle_number)
    if (!number) {
      throw validationError('Vehicle number must be 4 to 12 letters or digits')
    }
    if (body.is_primary !== undefined && typeof body.is_primary !== 'boolean') {
      throw validationError('is_primary must be a boolean')
    }

    const result = await callVehicleFunction('add_vehicle', {
      p_user_id: req.user.id,
      p_vehicle_number: number,
      p_make_primary: body.is_primary === true,
    })
    return res.status(201).json(result)
  } catch (error) {
    return sendError(res, error, 'add vehicle')
  }
})

// PATCH /user/vehicles/:id  { is_primary: true }
router.patch('/vehicles/:id', async (req, res) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) {
      throw new RequestError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found')
    }
    if (req.body?.is_primary !== true) {
      throw validationError('Only { "is_primary": true } is supported')
    }

    const result = await callVehicleFunction('set_primary_vehicle', {
      p_user_id: req.user.id,
      p_vehicle_id: req.params.id,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'set primary vehicle')
  }
})

// DELETE /user/vehicles/:id
router.delete('/vehicles/:id', async (req, res) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) {
      throw new RequestError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found')
    }

    const result = await callVehicleFunction('delete_vehicle', {
      p_user_id: req.user.id,
      p_vehicle_id: req.params.id,
    })
    return res.json(result)
  } catch (error) {
    return sendError(res, error, 'delete vehicle')
  }
})

module.exports = router

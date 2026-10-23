const { jwtVerify, createRemoteJWKSet } = require('jose')

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.split(' ')[1]
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    })

    req.user = { id: payload.sub }
    next()
  } catch (error) {
    console.error('auth middleware error:', error.message)
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = requireAuth
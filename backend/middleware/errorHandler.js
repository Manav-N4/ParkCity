function errorHandler(err, req, res, next) {
  console.error('unhandled error:', err)
  res.status(500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  })
}

module.exports = errorHandler


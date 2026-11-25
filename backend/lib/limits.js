// Small in-memory guards for endpoints that trigger billed upstream calls.
// State lives in this process only and resets on restart; Google Cloud
// quotas remain the hard cap.

// Fixed-window counter per key (e.g. per user id).
function createRateLimiter({ limit, windowMs }) {
  const windows = new Map()

  return function consume(key) {
    const now = Date.now()
    const current = windows.get(key)

    if (!current || now - current.start >= windowMs) {
      windows.set(key, { start: now, count: 1 })

      // Opportunistic cleanup so the map cannot grow without bound.
      if (windows.size > 10000) {
        for (const [k, w] of windows) {
          if (now - w.start >= windowMs) windows.delete(k)
        }
      }
      return true
    }

    if (current.count >= limit) return false
    current.count += 1
    return true
  }
}

// Caps the number of operations running at the same time.
function createConcurrencyGate(max) {
  let active = 0

  return {
    tryAcquire() {
      if (active >= max) return false
      active += 1
      return true
    },
    release() {
      active = Math.max(0, active - 1)
    },
  }
}

// Counts events per UTC day and refuses once the limit is reached.
function createDailyBudget(limit) {
  let day = null
  let used = 0

  const today = () => new Date().toISOString().slice(0, 10)

  return {
    tryConsume() {
      const d = today()
      if (d !== day) {
        day = d
        used = 0
      }
      if (used >= limit) return false
      used += 1
      return true
    },
  }
}

module.exports = {
  createRateLimiter,
  createConcurrencyGate,
  createDailyBudget,
}

// Rules for accepting a device location for a claim's entry photo.
// Pure functions (no React Native imports) so they can be tested directly.

export const LOCATION_RULES = {
  // Cached fixes older than this are not used.
  maxAgeMs: 2 * 60 * 1000,
  // Reported accuracy (metres, 68% radius) must be this good or better.
  // The backend flags claims more than 500 m from the spot.
  maxAccuracyMeters: 100,
  // How long to wait for a fresh fix before falling back.
  freshTimeoutMs: 15 * 1000,
  // Tolerated clock skew for timestamps slightly in the future.
  maxFutureSkewMs: 60 * 1000,
} as const;

export type PositionLike = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null | undefined;
  };
  timestamp: number;
};

export type LocationProblem = 'unavailable' | 'inaccurate' | 'stale';

export type ReliableLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: 'fresh' | 'cached';
};

export type LocationResult =
  | { ok: true; location: ReliableLocation }
  | { ok: false; problem: LocationProblem; accuracy: number | null };

type PositionCheck =
  | { ok: true }
  | { ok: false; problem: LocationProblem };

export function checkPosition(
  position: PositionLike,
  nowMs: number,
  rules = LOCATION_RULES,
): PositionCheck {
  const { latitude, longitude, accuracy } = position.coords;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { ok: false, problem: 'unavailable' };
  }

  if (
    typeof accuracy !== 'number' ||
    !Number.isFinite(accuracy) ||
    accuracy > rules.maxAccuracyMeters
  ) {
    return { ok: false, problem: 'inaccurate' };
  }

  const age = nowMs - position.timestamp;

  if (
    !Number.isFinite(age) ||
    age > rules.maxAgeMs ||
    age < -rules.maxFutureSkewMs
  ) {
    return { ok: false, problem: 'stale' };
  }

  return { ok: true };
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Location request timed out'));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Great-circle distance in metres between two coordinates (haversine).
export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadius = 6371000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// "350 m", "1.2 km", "12 km".
export function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return '';
  const roundedMeters = Math.max(10, Math.round(meters / 10) * 10);
  if (roundedMeters < 1000) return `${roundedMeters} m`;
  const km = meters / 1000;
  return km < 9.95 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Fresh fix first; a recent, accurate cached fix second; otherwise a problem
// the screen turns into a "retry" message.
export async function resolveReliableLocation(
  readFresh: () => Promise<PositionLike>,
  readCached: () => Promise<PositionLike | null>,
  now: () => number = Date.now,
): Promise<LocationResult> {
  let problem: LocationProblem = 'unavailable';
  let accuracy: number | null = null;

  const toLocation = (
    position: PositionLike,
    source: ReliableLocation['source'],
  ): ReliableLocation => ({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy as number,
    source,
  });

  try {
    const fresh = await readFresh();
    const check = checkPosition(fresh, now());

    if (check.ok) {
      return { ok: true, location: toLocation(fresh, 'fresh') };
    }

    problem = check.problem;
    accuracy = fresh.coords.accuracy ?? null;
  } catch {
    // Fall back to a cached fix below.
  }

  try {
    const cached = await readCached();

    if (cached) {
      const check = checkPosition(cached, now());

      if (check.ok) {
        return { ok: true, location: toLocation(cached, 'cached') };
      }

      if (problem === 'unavailable') {
        problem = check.problem;
        accuracy = cached.coords.accuracy ?? null;
      }
    }
  } catch {
    // No usable cached fix.
  }

  return { ok: false, problem, accuracy };
}

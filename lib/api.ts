
export const API_BASE_URL = 'https://parkcity.onrender.com';

export type PlaceDetails = {
  lat: number;
  lng: number;
};

export type SavedSpot = {
  id: string;
  name: string;
  address: string | null;
  price_per_hour: number | null;
  google_place_id: string;
  source: string;
  created_at: string;
  lat: number;
  lng: number;
};

export type SavedSpotAction = 'save' | 'unsave';

export type OwnerListing = {
  spot_id: string;
  views: number;
  navigations: number;
};

export type ListingDetails = {
  id: string;
  name: string;
  address: string | null;
  price_per_hour: number | null;
  google_place_id: string;
  source: string;
  created_at: string;
  lat: number;
  lng: number;
  available_count: number | null;
  total_count: number | null;
  availability_updated_at: string | null;
  availability_status: 'live' | 'stale' | 'unconfirmed';
  average_rating?: number | null;
  rating_count?: number;
  attributes: {
    price_per_hour?: {
      value: string;
      source: string;
    };
  } | null;
  verification_tier: string;
  amenities: {
    petrol_bunk?: boolean;
    ev_charging?: boolean;
    car_wash?: boolean;
  } | null;
};

export type ReportIssueType =
  | 'wrong_price'
  | 'permanently_closed'
  | 'wrong_location'
  | 'unsafe'
  | 'other';

export type ReportIssuePayload = {
  spot_id: string;
  issue_type: ReportIssueType;
  field_name: 'price_per_hour' | null;
  reported_value: string | null;
  photo_url?: string;
};

// ------------------------------------------
// PARKING SESSIONS
// ------------------------------------------

export type CheckInResponse = {
  success: boolean;
  session_id: string;
  checked_in_at: string;
};

export type CheckOutResponse = {
  success: boolean;
  duration_minutes: number;
  estimated_cost: number | null;
};

export type ParkingHistoryItem = {
  id: string;
  spot_id: string;
  user_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  duration_minutes: number | null;
  estimated_cost: number | null;
  parking_spots: {
    name: string;
    address: string | null;
  } | null;
};

// ------------------------------------------
// PARKING RATINGS
// ------------------------------------------

export type ParkingRatingPayload = {
  spot_id: string;
  session_id: string;
  rating: number;
  comment?: string | null;
};

export type ParkingRatingResponse = {
  success: boolean;
};

// ------------------------------------------
// SPEND SUMMARY
// ------------------------------------------

export type SpendAreaBreakdown = {
  area: string;
  sessions: number;
  total: number;
};

export type SpendSummary = {
  total_this_month: number;
  sessions_this_month: number;
  total_last_month: number;
  month_over_month_diff: number;
  area_breakdown: SpendAreaBreakdown[];
};

async function getErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const responseText = await response.text();

  try {
    const result = responseText ? JSON.parse(responseText) : {};
    return result.error || result.message || fallback;
  } catch {
    return responseText || fallback;
  }
}

export async function checkInToSpot(
  accessToken: string,
  spotId: string,
  latitude: number,
  longitude: number
): Promise<CheckInResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      spot_id: spotId,
      user_lat: latitude,
      user_lng: longitude,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Check-in failed: ${response.status}`
      )
    );
  }

  const result: CheckInResponse = await response.json();

  if (!result.success || !result.session_id) {
    throw new Error('The server did not confirm your check-in.');
  }

  return result;
}

export async function checkOutFromSpot(
  accessToken: string,
  sessionId: string
): Promise<CheckOutResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Check-out failed: ${response.status}`
      )
    );
  }

  const result: CheckOutResponse = await response.json();

  if (!result.success) {
    throw new Error('The server did not confirm your check-out.');
  }

  return result;
}

export async function getParkingHistory(
  accessToken: string
): Promise<ParkingHistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/sessions/history`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Failed to fetch parking history: ${response.status}`
      )
    );
  }

  return response.json();
}

export async function getSpendSummary(
  accessToken: string
): Promise<SpendSummary> {
  const response = await fetch(`${API_BASE_URL}/spend`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Failed to fetch spend summary: ${response.status}`
      )
    );
  }

  return response.json();
}

// ------------------------------------------
// RATING SUBMISSION
// ------------------------------------------

export async function submitParkingRating(
  accessToken: string,
  ratingData: ParkingRatingPayload
): Promise<ParkingRatingResponse> {
  const response = await fetch(`${API_BASE_URL}/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(ratingData),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Failed to submit rating: ${response.status}`
      )
    );
  }

  const result: ParkingRatingResponse = await response.json();

  if (result.success !== true) {
    throw new Error('The server did not confirm your rating submission.');
  }

  return result;
}

// ------------------------------------------
// REPORTS
// ------------------------------------------

export async function submitReport(
  accessToken: string,
  reportData: ReportIssuePayload
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(reportData),
  });

  const responseText = await response.text();

  let responseBody: {
    success?: boolean;
    error?: string;
  } = {};

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    // Handle a non-JSON response below.
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        responseBody.error ||
          'Report limit reached. Try again tomorrow.'
      );
    }

    throw new Error(
      responseBody.error ||
        `Could not submit report. Server returned ${response.status}.`
    );
  }

  if (responseBody.success !== true) {
    throw new Error(
      'The server did not confirm your report submission.'
    );
  }
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails> {
  const response = await fetch(`${API_BASE_URL}/place-details`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      place_id: placeId,
      sessiontoken: sessionToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json();

    throw new Error(
      errorBody.error ||
        `Place details request failed: ${response.status}`
    );
  }

  return response.json();
}

export async function searchNearbyParking(
  lat: number,
  lng: number
): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      lat,
      lng,
    }),
  });

  const responseText = await response.text();

  console.log('[Parking Search] HTTP Status:', response.status);
  console.log('[Parking Search] Raw Response:', responseText);

  let result: unknown;

  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(
      `Parking search returned invalid JSON: ${responseText.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    const errorResult = result as {
      error?: string;
      message?: string;
    } | null;

    throw new Error(
      errorResult?.error ||
        errorResult?.message ||
        `Parking search failed: ${response.status}`
    );
  }

  return result;
}

export async function logNavigation(
  spotId: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/navigation-log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spot_id: spotId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Navigation log failed: ${response.status}`
    );
  }
}

export async function getOwnerListings(
  accessToken: string
): Promise<OwnerListing[]> {
  const response = await fetch(`${API_BASE_URL}/stats/owner`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch your listings: ${response.status}`
    );
  }

  return response.json();
}

export async function getSpotAvailability(
  spotId: string
): Promise<ListingDetails> {
  const response = await fetch(
    `${API_BASE_URL}/search/${encodeURIComponent(spotId)}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch spot details: ${response.status}`
    );
  }

  return response.json();
}

export async function updateSpotAvailability(
  accessToken: string,
  spotId: string,
  availableCount: number,
  totalCount: number
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/availability/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      spot_id: spotId,
      available_count: availableCount,
      total_count: totalCount,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to update availability: ${response.status}`
    );
  }
}

// ------------------------------------------
// SAVED SPOTS
// ------------------------------------------

export async function getSavedSpots(
  accessToken: string
): Promise<SavedSpot[]> {
  const response = await fetch(`${API_BASE_URL}/saved`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch saved spots: ${response.status}`
    );
  }

  return response.json();
}

export async function toggleSavedSpot(
  accessToken: string,
  spotId: string,
  action: SavedSpotAction
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/saved/toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      spot_id: spotId,
      action,
    }),
  });

  const responseText = await response.text();

  let result: {
    success?: boolean;
    error?: string;
    message?: string;
  } = {};

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    // Response was not JSON.
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
        result.message ||
        `Failed to ${action} spot: ${response.status} - ${responseText}`
    );
  }

  if (result.success !== true) {
    throw new Error(
      result.error ||
        result.message ||
        `The server did not confirm the ${action} action.`
    );
  }
}

// ------------------------------------------
// PARKING REMINDERS
// ------------------------------------------

export async function setParkingReminder(
  accessToken: string,
  sessionId: string,
  reminderMinutesBefore: number
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/reminders/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      reminder_minutes_before: reminderMinutesBefore,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(
        response,
        `Failed to set parking reminder: ${response.status}`
      )
    );
  }
}

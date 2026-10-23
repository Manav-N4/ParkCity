export const API_BASE_URL = 'https://parkcity.onrender.com';

export type PlaceDetails = {
  lat: number;
  lng: number;
};

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
) {
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

  if (!response.ok) {
    const errorBody = await response.json();

    throw new Error(
      errorBody.error ||
        `Parking search failed: ${response.status}`
    );
  }

  return response.json();
}

export async function logNavigation(spotId: string): Promise<void> {
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
    throw new Error(`Navigation log failed: ${response.status}`);
  }
}

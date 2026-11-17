export type VerificationTier =
  | "field_verified"
  | "owner_verified"
  | "crowd_verified"
  | "google_raw"
  | "unverified";

export type ParkingSpot = {
  id: string | null;
  google_place_id: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  price_per_hour: number | null;
  source: string;
  verification_tier?: VerificationTier;
};

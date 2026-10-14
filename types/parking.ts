export type ParkingSpot = {
  google_place_id: string;
  name: string;
  lat: number;
  lng: number;
  price_per_hour: number | null;
  source: string;
};

export type AircraftStatus = "active" | "maintenance" | "grounded" | "retired";

export interface Rank {
  id: string;
  code: string;
  name: string;
  minimum_hours: number;
  minimum_flights: number;
  badge_url: string | null;
  priority: number;
}

export interface FleetType {
  id: string;
  icao_code: string;
  manufacturer: string;
  model: string;
  engine_count: number;
  engine_type: string | null;
  range_nm: number | null;
  cruise_speed_kts: number | null;
  max_passengers: number | null;
  active: boolean;
}

export interface Airport {
  id: string;
  icao_code: string;
  iata_code: string | null;
  name: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

import {createClient} from "@/lib/supabase/server";

type Airport = {
  icao_code: string;
};

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
};

type Aircraft = {
  registration: string;
  status: string;
  assigned_pilot_id: string | null;
  fleet_type: FleetType | FleetType[] | null;
};

type Route = {
  flight_number: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};

type Pilot = {
  full_name: string;
  callsign: string;
};

type Booking = {
  id: string;
  status: string;
  started_at: string | null;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
  pilot: Pilot | Pilot[] | null;
};

type Pirep = {
  id: string;
  pirep_code: string;
  flight_number: string;
  block_minutes: number;
  landing_rate: number | null;
  status: string;
  created_at: string;
  pilot: Pilot | Pilot[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function getOperationsData() {
  const supabase = await createClient();

  const [
    {data: aircraftData, error: aircraftError},
    {data: bookingData, error: bookingError},
    {data: pirepData, error: pirepError}
  ] = await Promise.all([
    supabase
      .from("aircraft")
      .select(`
        registration,
        status,
        assigned_pilot_id,
        fleet_type:fleet_types(
          icao_code,
          manufacturer,
          model
        )
      `),
    supabase
      .from("flight_bookings")
      .select(`
        id,
        status,
        started_at,
        route:routes(
          flight_number,
          departure:airports!routes_departure_airport_id_fkey(icao_code),
          arrival:airports!routes_arrival_airport_id_fkey(icao_code)
        ),
        aircraft:aircraft(
          registration,
          status,
          assigned_pilot_id,
          fleet_type:fleet_types(
            icao_code,
            manufacturer,
            model
          )
        ),
        pilot:profiles!flight_bookings_pilot_id_fkey(
          full_name,
          callsign
        )
      `)
      .in("status", ["boarding", "departed", "enroute", "landed"])
      .order("started_at", {ascending: false}),
    supabase
      .from("pireps")
      .select(`
        id,
        pirep_code,
        flight_number,
        block_minutes,
        landing_rate,
        status,
        created_at,
        pilot:profiles!pireps_pilot_id_fkey(
          full_name,
          callsign
        )
      `)
      .order("created_at", {ascending: false})
      .limit(8)
  ]);

  if (aircraftError) {
    throw new Error(`Unable to load fleet summary: ${aircraftError.message}`);
  }

  if (bookingError) {
    throw new Error(`Unable to load live flights: ${bookingError.message}`);
  }

  if (pirepError) {
    throw new Error(`Unable to load recent PIREPs: ${pirepError.message}`);
  }

  const aircraft = (aircraftData ?? []) as unknown as Aircraft[];
  const liveFlights = (bookingData ?? []) as unknown as Booking[];
  const recentPireps = (pirepData ?? []) as unknown as Pirep[];

  const totalAircraft = aircraft.length;
  const availableAircraft = aircraft.filter(
    (item) => item.status === "active" && !item.assigned_pilot_id
  ).length;
  const assignedAircraft = aircraft.filter(
    (item) => item.status === "active" && Boolean(item.assigned_pilot_id)
  ).length;
  const maintenanceAircraft = aircraft.filter(
    (item) => item.status === "maintenance"
  ).length;
  const groundedAircraft = aircraft.filter(
    (item) => item.status === "grounded"
  ).length;
  const retiredAircraft = aircraft.filter(
    (item) => item.status === "retired"
  ).length;

  const pendingPireps = recentPireps.filter(
    (pirep) => pirep.status === "submitted"
  ).length;

  const totalBlockMinutes = recentPireps.reduce(
    (sum, pirep) => sum + (pirep.block_minutes ?? 0),
    0
  );

  const landingRates = recentPireps
    .map((pirep) => pirep.landing_rate)
    .filter((value): value is number => typeof value === "number");

  const averageLandingRate = landingRates.length
    ? Math.round(
        landingRates.reduce((sum, value) => sum + value, 0) /
          landingRates.length
      )
    : null;

  const fleetMap = new Map<
    string,
    {
      icaoCode: string;
      manufacturer: string;
      model: string;
      total: number;
      available: number;
      assigned: number;
      maintenance: number;
    }
  >();

  for (const item of aircraft) {
    const type = first(item.fleet_type);
    const key = type?.icao_code ?? "UNKNOWN";
    const current = fleetMap.get(key) ?? {
      icaoCode: key,
      manufacturer: type?.manufacturer ?? "Unknown",
      model: type?.model ?? "Unknown",
      total: 0,
      available: 0,
      assigned: 0,
      maintenance: 0
    };

    current.total += 1;

    if (item.status === "active" && !item.assigned_pilot_id) {
      current.available += 1;
    } else if (item.status === "active" && item.assigned_pilot_id) {
      current.assigned += 1;
    } else if (item.status === "maintenance") {
      current.maintenance += 1;
    }

    fleetMap.set(key, current);
  }

  return {
    stats: {
      totalAircraft,
      availableAircraft,
      assignedAircraft,
      maintenanceAircraft,
      groundedAircraft,
      retiredAircraft,
      activeFlights: liveFlights.length,
      pendingPireps,
      blockHours: Math.round((totalBlockMinutes / 60) * 10) / 10,
      averageLandingRate
    },
    liveFlights: liveFlights.map((booking) => {
      const route = first(booking.route);
      const aircraftItem = first(booking.aircraft);
      const pilot = first(booking.pilot);

      return {
        id: booking.id,
        flightNumber: route?.flight_number ?? "—",
        departure: first(route?.departure)?.icao_code ?? "—",
        arrival: first(route?.arrival)?.icao_code ?? "—",
        registration: aircraftItem?.registration ?? "Unassigned",
        aircraftType: first(aircraftItem?.fleet_type)?.icao_code ?? "—",
        pilotName: pilot?.full_name ?? "Unknown pilot",
        callsign: pilot?.callsign ?? "—",
        status: booking.status,
        startedAt: booking.started_at
      };
    }),
    fleetSummary: Array.from(fleetMap.values()).sort((a, b) =>
      a.icaoCode.localeCompare(b.icaoCode)
    ),
    recentPireps: recentPireps.map((pirep) => {
      const pilot = first(pirep.pilot);

      return {
        id: pirep.id,
        code: pirep.pirep_code,
        flightNumber: pirep.flight_number,
        blockMinutes: pirep.block_minutes,
        landingRate: pirep.landing_rate,
        status: pirep.status,
        createdAt: pirep.created_at,
        pilotName: pilot?.full_name ?? "Unknown pilot",
        callsign: pilot?.callsign ?? "—"
      };
    })
  };
}

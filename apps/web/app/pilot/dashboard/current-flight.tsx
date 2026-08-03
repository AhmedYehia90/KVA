import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import styles from "./current-flight.module.css";

type Airport = {icao_code: string; city: string | null};
type FleetType = {icao_code: string; manufacturer: string; model: string};
type Aircraft = {
  registration: string;
  fleet_type: FleetType | FleetType[] | null;
};
type Route = {
  flight_number: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};
type Dispatch = {dispatch_number: string};
type ActiveBooking = {
  id: string;
  status: string;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
  dispatches: Dispatch | Dispatch[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function CurrentFlightCard({pilotId}: {pilotId: string}) {
  const supabase = await createClient();

  const {data, error} = await supabase
    .from("flight_bookings")
    .select(`
      id,
      status,
      route:routes(
        flight_number,
        departure:airports!routes_departure_airport_id_fkey(icao_code, city),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code, city)
      ),
      aircraft:aircraft(
        registration,
        fleet_type:fleet_types(icao_code, manufacturer, model)
      ),
      dispatches(dispatch_number)
    `)
    .eq("pilot_id", pilotId)
    .in("status", ["booked", "boarding", "departed", "enroute", "landed"])
    .order("booked_at", {ascending: false})
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load current flight: ${error.message}`);
  }

  if (!data) return null;

  const booking = data as unknown as ActiveBooking;
  const route = first(booking.route);
  const aircraft = first(booking.aircraft);
  const fleetType = first(aircraft?.fleet_type);
  const dispatch = first(booking.dispatches);
  const departure = first(route?.departure);
  const arrival = first(route?.arrival);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Current Flight</p>
          <h2>{route?.flight_number ?? "Active Assignment"}</h2>
          <div className={styles.route}>
            <div>
              <strong>{departure?.icao_code ?? "—"}</strong>
              <span>{departure?.city ?? "Departure"}</span>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <strong>{arrival?.icao_code ?? "—"}</strong>
              <span>{arrival?.city ?? "Arrival"}</span>
            </div>
          </div>
        </div>

        <span className={`${styles.status} ${styles[booking.status]}`}>
          {booking.status}
        </span>
      </div>

      <div className={styles.details}>
        <div>
          <span>Aircraft</span>
          <strong>{aircraft?.registration ?? "Pending"}</strong>
          <small>
            {fleetType
              ? `${fleetType.icao_code} · ${fleetType.manufacturer} ${fleetType.model}`
              : "Aircraft assignment pending"}
          </small>
        </div>

        <div>
          <span>Dispatch</span>
          <strong>{dispatch?.dispatch_number ?? "Pending"}</strong>
          <small>Operational release</small>
        </div>

        <div>
          <span>Flight Phase</span>
          <strong>{booking.status}</strong>
          <small>Continue from the dispatch package</small>
        </div>
      </div>

      <div className={styles.actions}>
        <Link className="button" href={`/pilot/bookings/${booking.id}`}>
          Continue Flight
        </Link>
        <Link className="button outline" href="/pilot/flights">
          Browse Flights
        </Link>
      </div>
    </section>
  );
}

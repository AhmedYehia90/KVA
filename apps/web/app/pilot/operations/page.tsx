import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {advanceOperationAction} from "./actions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Flight Operations | Kalabsha Airlines",
  description: "Operate your active Kalabsha Airlines flight."
};

const phases = ["boarding","pushback","taxi","takeoff","climb","cruise","descent","landing","arrived","completed"] as const;
const actionLabels: Record<string, string> = {
  boarding: "Start Pushback",
  pushback: "Start Taxi",
  taxi: "Confirm Takeoff",
  takeoff: "Begin Climb",
  climb: "Set Cruise",
  cruise: "Begin Descent",
  descent: "Begin Landing",
  landing: "Mark Arrived",
  arrived: "Complete Flight"
};

type Airport = {icao_code: string; city: string | null};
type FleetType = {icao_code: string; manufacturer: string; model: string};
type Aircraft = {registration: string; status: string; fleet_type: FleetType | FleetType[] | null};
type Route = {flight_number: string; distance_nm: number | null; scheduled_minutes: number | null; departure: Airport | Airport[] | null; arrival: Airport | Airport[] | null};
type Dispatch = {dispatch_number: string};
type Event = {id: string; event: string; created_at: string};
type Booking = {id: string; status: string; operation_phase: string; route: Route | Route[] | null; aircraft: Aircraft | Aircraft[] | null; dispatches: Dispatch | Dispatch[] | null; flight_events: Event[] | null};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function duration(minutes: number | null) {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export default async function OperationsPage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const query = await searchParams;
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase
    .from("flight_bookings")
    .select(`
      id,
      status,
      operation_phase,
      route:routes(
        flight_number,
        distance_nm,
        scheduled_minutes,
        departure:airports!routes_departure_airport_id_fkey(icao_code, city),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code, city)
      ),
      aircraft:aircraft(
        registration,
        status,
        fleet_type:fleet_types(icao_code, manufacturer, model)
      ),
      dispatches(dispatch_number),
      flight_events(id, event, created_at)
    `)
    .eq("pilot_id", user.id)
    .neq("operation_phase", "completed")
    .order("booked_at", {ascending: false})
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Unable to load operations: ${error.message}`);

  if (!data) {
    return (
      <main className={styles.main}>
        <section className={styles.empty}>
          <p className="eyebrow">Flight Operations</p>
          <h1>No Active Flight</h1>
          <p>Book an available route to begin an operational cycle.</p>
          <Link className="button" href="/pilot/flights">Browse Flights</Link>
        </section>
      </main>
    );
  }

  const booking = data as unknown as Booking;
  const route = first(booking.route);
  const aircraft = first(booking.aircraft);
  const fleet = first(aircraft?.fleet_type);
  const dispatch = first(booking.dispatches);
  const departure = first(route?.departure);
  const arrival = first(route?.arrival);
  const phaseIndex = phases.indexOf(booking.operation_phase as (typeof phases)[number]);
  const actionLabel = actionLabels[booking.operation_phase];
  const events = [...(booking.flight_events ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <main className={styles.main}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="eyebrow">Flight Operations</p>
            <h1>{route?.flight_number ?? "Active Flight"}</h1>
            <div className={styles.route}>
              <span><strong>{departure?.icao_code ?? "—"}</strong><small>{departure?.city ?? "Departure"}</small></span>
              <i aria-hidden="true">✈</i>
              <span><strong>{arrival?.icao_code ?? "—"}</strong><small>{arrival?.city ?? "Arrival"}</small></span>
            </div>
          </div>
          <div className={styles.phaseCard}>
            <span>Current Phase</span>
            <strong>{booking.operation_phase}</strong>
            <small>State machine controlled</small>
          </div>
        </header>

        {query.error ? <div className={styles.error}>{decodeURIComponent(query.error)}</div> : null}

        <section className={styles.summary}>
          <article><span>Aircraft</span><strong>{aircraft?.registration ?? "Pending"}</strong><small>{fleet ? `${fleet.icao_code} · ${fleet.manufacturer} ${fleet.model}` : "Aircraft unavailable"}</small></article>
          <article><span>Dispatch</span><strong>{dispatch?.dispatch_number ?? "Pending"}</strong><small>Operational release</small></article>
          <article><span>Distance</span><strong>{route?.distance_nm ? `${route.distance_nm.toLocaleString("en-US")} NM` : "—"}</strong><small>Published route distance</small></article>
          <article><span>Block Time</span><strong>{duration(route?.scheduled_minutes ?? null)}</strong><small>Scheduled gate-to-gate</small></article>
        </section>

        <section className={styles.timeline}>
          {phases.map((phase, index) => {
            const complete = phaseIndex >= index;
            const current = phaseIndex === index;
            return (
              <div className={styles.step} key={phase}>
                <span className={`${styles.dot} ${complete ? styles.complete : ""} ${current ? styles.current : ""}`} />
                <strong>{phase}</strong>
              </div>
            );
          })}
        </section>

        <div className={styles.actions}>
          {actionLabel ? (
            <form action={advanceOperationAction}>
              <input name="bookingId" type="hidden" value={booking.id} />
              <button className="button" type="submit">{actionLabel}</button>
            </form>
          ) : null}
          <Link className="button outline" href={`/pilot/bookings/${booking.id}`}>Open Dispatch</Link>
          <Link className="button outline" href="/pilot/dashboard">Dashboard</Link>
        </div>

        <section className={styles.log}>
          <div><p className="eyebrow">Event Log</p><h2>Operational History</h2></div>
          <div className={styles.logList}>
            {events.length ? events.map((event) => (
              <article key={event.id}>
                <strong>{event.event.replaceAll("_", " ")}</strong>
                <span>{new Intl.DateTimeFormat("en-GB", {day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"}).format(new Date(event.created_at))}</span>
              </article>
            )) : <p>No events recorded yet.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}

import type {Metadata} from "next";
import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {bookFlightAction} from "./actions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Flight Details | Kalabsha Airlines",
  description: "Review route details and book a Kalabsha Airlines flight."
};

type Airport = {
  icao_code: string;
  name: string;
  city: string | null;
  country_code: string | null;
};

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
  range_nm: number | null;
  cruise_speed_kts: number | null;
};

type Route = {
  id: string;
  flight_number: string;
  scheduled_minutes: number | null;
  distance_nm: number | null;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
  fleet_type: FleetType | FleetType[] | null;
};

type Booking = {
  id: string;
  status: string;
  route_id: string;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDuration(totalMinutes: number | null) {
  if (!totalMinutes) return "—";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export default async function FlightDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{id: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const {id} = await params;
  const {error: actionError} = await searchParams;

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  const [{data: routeData, error: routeError}, {data: activeBookingData}] =
    await Promise.all([
      supabase
        .from("routes")
        .select(
          `
            id,
            flight_number,
            scheduled_minutes,
            distance_nm,
            departure:airports!routes_departure_airport_id_fkey(
              icao_code,
              name,
              city,
              country_code
            ),
            arrival:airports!routes_arrival_airport_id_fkey(
              icao_code,
              name,
              city,
              country_code
            ),
            fleet_type:fleet_types!routes_fleet_type_id_fkey(
              icao_code,
              manufacturer,
              model,
              range_nm,
              cruise_speed_kts
            )
          `
        )
        .eq("id", id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("flight_bookings")
        .select("id, status, route_id")
        .eq("pilot_id", user.id)
        .in("status", ["booked", "boarding", "departed", "enroute", "landed"])
        .maybeSingle()
    ]);

  if (routeError) {
    throw new Error(`Unable to load flight: ${routeError.message}`);
  }

  if (!routeData) {
    notFound();
  }

  const route = routeData as unknown as Route;
  const activeBooking = activeBookingData as Booking | null;
  const departure = first(route.departure);
  const arrival = first(route.arrival);
  const fleet = first(route.fleet_type);
  const alreadyBooked = activeBooking?.route_id === route.id;

  return (
    <main>
      <section className={styles.hero}>
        <div className="container">
          <Link className={styles.backLink} href="/pilot/flights">
            ← Available flights
          </Link>

          <div className={styles.heroGrid}>
            <div>
              <p className="eyebrow">Flight Operations</p>
              <h1>{route.flight_number}</h1>
              <p className={styles.routeLine}>
                {departure?.icao_code ?? "—"}
                <span aria-hidden="true">→</span>
                {arrival?.icao_code ?? "—"}
              </p>
            </div>

            <aside className={styles.statusCard}>
              <span>Route status</span>
              <strong>Available</strong>
              <small>Active network schedule</small>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.content}>
        <div className={`container ${styles.layout}`}>
          <div className={styles.mainColumn}>
            <section className={styles.airports}>
              <article>
                <p className="eyebrow">Departure</p>
                <strong>{departure?.icao_code ?? "—"}</strong>
                <h2>{departure?.name ?? "Airport not available"}</h2>
                <span>
                  {[departure?.city, departure?.country_code]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </article>

              <div className={styles.routeDivider} aria-hidden="true">
                <span />
                <b>✈</b>
                <span />
              </div>

              <article>
                <p className="eyebrow">Arrival</p>
                <strong>{arrival?.icao_code ?? "—"}</strong>
                <h2>{arrival?.name ?? "Airport not available"}</h2>
                <span>
                  {[arrival?.city, arrival?.country_code]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </span>
              </article>
            </section>

            <section className={styles.infoGrid}>
              <article>
                <span>Aircraft</span>
                <strong>{fleet?.icao_code ?? "—"}</strong>
                <small>
                  {fleet
                    ? `${fleet.manufacturer} ${fleet.model}`
                    : "Not assigned"}
                </small>
              </article>

              <article>
                <span>Scheduled block</span>
                <strong>{formatDuration(route.scheduled_minutes)}</strong>
                <small>Planned gate-to-gate time</small>
              </article>

              <article>
                <span>Distance</span>
                <strong>
                  {route.distance_nm
                    ? `${route.distance_nm.toLocaleString()} NM`
                    : "—"}
                </strong>
                <small>Published route distance</small>
              </article>

              <article>
                <span>Cruise speed</span>
                <strong>
                  {fleet?.cruise_speed_kts
                    ? `${fleet.cruise_speed_kts} KT`
                    : "—"}
                </strong>
                <small>Fleet reference speed</small>
              </article>
            </section>
          </div>

          <aside className={styles.bookingCard}>
            <p className="eyebrow">Flight Booking</p>
            <h2>Reserve this flight</h2>
            <p>
              Booking creates your active assignment and a numbered dispatch
              package.
            </p>

            {actionError ? (
              <div className={styles.error} role="alert">
                {decodeURIComponent(actionError)}
              </div>
            ) : null}

            {alreadyBooked ? (
              <>
                <div className={styles.currentBooking}>
                  <span>Current status</span>
                  <strong>{activeBooking.status}</strong>
                </div>
                <Link className="button" href="/pilot/dashboard">
                  Open dashboard
                </Link>
              </>
            ) : activeBooking ? (
              <>
                <div className={styles.warning}>
                  You already have another active flight. Complete or cancel it
                  before booking this route.
                </div>
                <Link className="button outline" href="/pilot/dashboard">
                  View active flight
                </Link>
              </>
            ) : (
              <form action={bookFlightAction}>
                <input name="routeId" type="hidden" value={route.id} />
                <button className="button" type="submit">
                  Book flight
                </button>
              </form>
            )}

            <ul>
              <li>One active booking per pilot</li>
              <li>Aircraft assigned when available</li>
              <li>Dispatch number generated automatically</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}

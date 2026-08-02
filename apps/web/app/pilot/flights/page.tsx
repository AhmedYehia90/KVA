import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Available Flights | Kalabsha Airlines",
  description: "Browse and select available Kalabsha Airlines routes."
};

type Airport = {
  icao_code: string;
  name: string;
  city: string | null;
};

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
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

type SearchParams = Promise<{
  q?: string;
  departure?: string;
  fleet?: string;
}>;

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDuration(totalMinutes: number | null) {
  if (!totalMinutes) return "—";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export default async function PilotFlightsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const filters = await searchParams;
  const query = filters.q?.trim().toUpperCase() ?? "";
  const departureFilter = filters.departure?.trim().toUpperCase() ?? "";
  const fleetFilter = filters.fleet?.trim().toUpperCase() ?? "";

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  const {data, error} = await supabase
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
          city
        ),
        arrival:airports!routes_arrival_airport_id_fkey(
          icao_code,
          name,
          city
        ),
        fleet_type:fleet_types!routes_fleet_type_id_fkey(
          icao_code,
          manufacturer,
          model
        )
      `
    )
    .eq("active", true)
    .order("flight_number", {ascending: true});

  if (error) {
    throw new Error(`Unable to load available flights: ${error.message}`);
  }

  const routes = (data ?? []) as unknown as Route[];

  const departureOptions = Array.from(
    new Set(
      routes
        .map((route) => first(route.departure)?.icao_code)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  const fleetOptions = Array.from(
    new Set(
      routes
        .map((route) => first(route.fleet_type)?.icao_code)
        .filter((value): value is string => Boolean(value))
    )
  ).sort();

  const filteredRoutes = routes.filter((route) => {
    const departure = first(route.departure);
    const arrival = first(route.arrival);
    const fleet = first(route.fleet_type);

    const searchable = [
      route.flight_number,
      departure?.icao_code,
      departure?.name,
      departure?.city,
      arrival?.icao_code,
      arrival?.name,
      arrival?.city,
      fleet?.icao_code,
      fleet?.manufacturer,
      fleet?.model
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();

    return (
      (!query || searchable.includes(query)) &&
      (!departureFilter || departure?.icao_code === departureFilter) &&
      (!fleetFilter || fleet?.icao_code === fleetFilter)
    );
  });

  return (
    <main>
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow">Flight Operations</p>
          <h1>Available Flights</h1>
          <p>
            Select an active Kalabsha Airlines route and continue to flight
            details before booking.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className="container">
          <form className={styles.filters}>
            <label>
              <span>Search</span>
              <input
                defaultValue={filters.q ?? ""}
                name="q"
                placeholder="Flight, airport or aircraft"
              />
            </label>

            <label>
              <span>Departure</span>
              <select
                defaultValue={departureFilter}
                name="departure"
              >
                <option value="">All airports</option>
                {departureOptions.map((icao) => (
                  <option key={icao} value={icao}>
                    {icao}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Fleet</span>
              <select defaultValue={fleetFilter} name="fleet">
                <option value="">All aircraft</option>
                {fleetOptions.map((icao) => (
                  <option key={icao} value={icao}>
                    {icao}
                  </option>
                ))}
              </select>
            </label>

            <button className="button" type="submit">
              Apply filters
            </button>

            <Link className="button outline" href="/pilot/flights">
              Clear
            </Link>
          </form>

          <div className={styles.summary}>
            <div>
              <p className="eyebrow">Network Schedule</p>
              <h2>{filteredRoutes.length} available routes</h2>
            </div>
            <span>All times shown as scheduled block time</span>
          </div>

          {filteredRoutes.length ? (
            <div className={styles.table}>
              <div className={`${styles.row} ${styles.tableHead}`}>
                <span>Flight</span>
                <span>Route</span>
                <span>Aircraft</span>
                <span>Block time</span>
                <span>Distance</span>
                <span>Status</span>
                <span />
              </div>

              {filteredRoutes.map((route) => {
                const departure = first(route.departure);
                const arrival = first(route.arrival);
                const fleet = first(route.fleet_type);

                return (
                  <article className={styles.row} key={route.id}>
                    <strong>{route.flight_number}</strong>

               <span className={styles.route}>
                <div>
                 <strong>{departure?.icao_code}</strong>
                 <span className={styles.city}> ({departure?.city})</span>
                </div>

                <i>↓</i>

                <div>
                 <strong>{arrival?.icao_code}</strong>
                 <span className={styles.city}> ({arrival?.city})</span>
                </div>
               </span>

               <span className={styles.aircraft}>
                 <strong>{fleet?.icao_code ?? "—"}</strong>

                 <small>
                      {fleet
                         ? `${fleet.manufacturer} ${fleet.model}`
                         : "Not assigned"}
                 </small>
               </span>

                    <span>{formatDuration(route.scheduled_minutes)}</span>

                    <span>
                      {route.distance_nm
                         ? `${route.distance_nm.toLocaleString("en-US")} NM`
                         : "—"}
                    </span>

                    <span className={styles.available}>Available</span>

                    <Link
                      className={styles.detailsLink}
                      href={`/pilot/flights/${route.id}`}
                    >
                      View flight
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className={styles.empty}>
              <h2>No matching flights</h2>
              <p>Change or clear the filters to view the active network.</p>
              <Link className="button outline" href="/pilot/flights">
                Clear filters
              </Link>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

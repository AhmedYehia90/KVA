import {getTranslations} from "next-intl/server";
import {createAdminClient} from "@/lib/supabase/admin";

type Airport = {
  icao_code: string;
};

type FleetType = {
  icao_code: string;
};

type Aircraft = {
  fleet_type: FleetType | FleetType[] | null;
};

type Route = {
  flight_number: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};

type Projection = {
  booking_id: string;
  status: string;
  last_event_at: string;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function statusLabel(value: string) {
  if (value === "enroute") return "En route";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function LiveFlights() {
  const t = await getTranslations("Home.liveFlights");
  const supabase = createAdminClient();

  const {data, error} = await supabase
    .from("operations_flight_projection")
    .select(`
      booking_id,
      status,
      last_event_at,
      route:routes!operations_flight_projection_route_id_fkey(
        flight_number,
        departure:airports!routes_departure_airport_id_fkey(icao_code),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code)
      ),
      aircraft:aircraft!operations_flight_projection_aircraft_id_fkey(
        fleet_type:fleet_types(icao_code)
      )
    `)
    .in("status", ["boarding", "departed", "enroute", "landed"])
    .order("last_event_at", {ascending: false})
    .limit(8);

  const flights = error ? [] : ((data ?? []) as unknown as Projection[]);

  return (
    <section className="section">
      <div className="container">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">{t("eyebrow")}</div>
            <h2>{t("title")}</h2>
          </div>
          <span className="liveBadge">
            <i />
            {error ? "Data unavailable" : t("networkActive")}
          </span>
        </div>

        {error ? (
          <div className="card">
            <h3>Live flight data is temporarily unavailable.</h3>
            <p className="muted">
              The public board is not showing simulated or placeholder flights.
            </p>
          </div>
        ) : flights.length === 0 ? (
          <div className="card">
            <h3>No active flights right now.</h3>
            <p className="muted">
              The board will update automatically when a KVA operation becomes active.
            </p>
          </div>
        ) : (
          <div className="flightTable" role="table" aria-label={t("aria")}>
            <div className="flightRow flightHead" role="row">
              <span>{t("flight")}</span>
              <span>{t("route")}</span>
              <span>{t("aircraft")}</span>
              <span>{t("status")}</span>
            </div>

            {flights.map((flight) => {
              const route = first(flight.route);
              const aircraft = first(flight.aircraft);
              const departure = first(route?.departure)?.icao_code ?? "—";
              const arrival = first(route?.arrival)?.icao_code ?? "—";
              const fleetType = first(aircraft?.fleet_type)?.icao_code ?? "—";

              return (
                <div className="flightRow" role="row" key={flight.booking_id}>
                  <strong>{route?.flight_number ?? "—"}</strong>
                  <span>{departure} → {arrival}</span>
                  <span>{fleetType}</span>
                  <span className="status">{statusLabel(flight.status)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

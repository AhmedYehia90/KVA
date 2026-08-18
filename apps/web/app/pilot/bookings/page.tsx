import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Airport = {
  icao_code: string;
  city: string | null;
};

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
};

type Aircraft = {
  registration: string;
  fleet_type: FleetType | FleetType[] | null;
};

type Route = {
  flight_number: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};

type Dispatch = {
  dispatch_number: string;
};

type Booking = {
  id: string;
  status: string;
  booked_at: string;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
  dispatches: Dispatch | Dispatch[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function PilotBookingsPage() {
  const supabase = await createClient();

  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pilots/login");
  }

  const {data, error} = await supabase
    .from("flight_bookings")
    .select(
      `
        id,
        status,
        booked_at,
        route:routes(
          flight_number,
          departure:airports!routes_departure_airport_id_fkey(
            icao_code,
            city
          ),
          arrival:airports!routes_arrival_airport_id_fkey(
            icao_code,
            city
          )
        ),
        aircraft:aircraft(
          registration,
          fleet_type:fleet_types(
            icao_code,
            manufacturer,
            model
          )
        ),
        dispatches(
          dispatch_number
        )
      `
    )
    .eq("pilot_id", user.id)
    .order("booked_at", {ascending: false});

  if (error) {
    throw new Error(`Unable to load bookings: ${error.message}`);
  }

  const bookings = (data ?? []) as unknown as Booking[];

  return (
    <main className="kvaPremiumSubpage">
      <section className="kvaPremiumHero">
        <div className="kvaPremiumHeroInner">
          <div className="kvaPremiumHeroRow">
          <div>
            <p className="eyebrow">Pilot Operations</p>
            <h1 className="kvaPremiumHeroTitle">My Bookings</h1>
            <p className="kvaPremiumHeroText">
              Open your current assignment or review previous bookings.
            </p>
          </div>

          <Link className="button kvaPremiumHeroSide" href="/pilot/flights">
            Browse Flights
          </Link>
          </div>
        </div>
      </section>

      <section className="kvaPremiumSubpageContent">
        <div className="kvaPremiumSubpageBody kvaPremiumSubpageBodyLift">
        {bookings.length ? (
          <div
            style={{
              overflow: "hidden",
              border: "1px solid var(--border)",
              borderRadius: 20,
              background: "var(--surface)"
            }}
          >
            {bookings.map((booking) => {
              const route = first(booking.route);
              const departure = first(route?.departure);
              const arrival = first(route?.arrival);
              const aircraft = first(booking.aircraft);
              const fleet = first(aircraft?.fleet_type);
              const dispatch = first(booking.dispatches);

              return (
                <article
                  key={booking.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr 1.2fr 1.1fr 1fr auto",
                    alignItems: "center",
                    gap: 18,
                    padding: 22,
                    borderTop: "1px solid rgba(105,183,231,.13)"
                  }}
                >
                  <div>
                    <small style={labelStyle}>FLIGHT</small>
                    <strong style={valueStyle}>
                      {route?.flight_number ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <small style={labelStyle}>ROUTE</small>
                    <strong style={valueStyle}>
                      {departure?.icao_code ?? "—"} →{" "}
                      {arrival?.icao_code ?? "—"}
                    </strong>
                    <span style={subValueStyle}>
                      {departure?.city ?? "Departure"} to{" "}
                      {arrival?.city ?? "Arrival"}
                    </span>
                  </div>

                  <div>
                    <small style={labelStyle}>AIRCRAFT</small>
                    <strong style={valueStyle}>
                      {aircraft?.registration ?? "Pending"}
                    </strong>
                    <span style={subValueStyle}>
                      {fleet
                        ? `${fleet.icao_code} · ${fleet.manufacturer} ${fleet.model}`
                        : "Not assigned"}
                    </span>
                  </div>

                  <div>
                    <small style={labelStyle}>STATUS</small>
                    <strong
                      style={{
                        ...valueStyle,
                        color: "#82edb5",
                        textTransform: "capitalize"
                      }}
                    >
                      {booking.status}
                    </strong>
                    <span style={subValueStyle}>
                      {dispatch?.dispatch_number ?? "Dispatch pending"}
                    </span>
                  </div>

                  <Link
                    className="button outline"
                    href={`/pilot/bookings/${booking.id}`}
                  >
                    Open
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <section
            style={{
              padding: 48,
              border: "1px solid var(--border)",
              borderRadius: 20,
              background: "var(--surface)",
              textAlign: "center"
            }}
          >
            <h2 style={{marginTop: 0}}>No bookings yet</h2>
            <p style={{color: "var(--muted)", marginBottom: 22}}>
              Choose an available flight to create your first booking.
            </p>
            <Link className="button kvaPremiumHeroSide" href="/pilot/flights">
              Browse Flights
            </Link>
          </section>
        )}
        </div>
      </section>
    </main>
  );
}

const labelStyle = {
  display: "block",
  color: "var(--muted)",
  fontWeight: 800,
  letterSpacing: ".08em"
} as const;

const valueStyle = {
  display: "block",
  marginTop: 7,
  fontSize: "1.05rem"
} as const;

const subValueStyle = {
  display: "block",
  marginTop: 5,
  color: "var(--muted)",
  fontSize: ".8rem"
} as const;

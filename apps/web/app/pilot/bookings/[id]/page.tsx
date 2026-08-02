import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {advanceFlightAction} from "./actions";

type Airport = {
  icao_code: string;
  city: string | null;
};

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
  cruise_speed_kts: number | null;
};

type Aircraft = {
  registration: string;
  status: string;
  fleet_type: FleetType | FleetType[] | null;
};

type Route = {
  flight_number: string;
  scheduled_minutes: number | null;
  distance_nm: number | null;
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
  started_at: string | null;
  completed_at: string | null;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
  dispatches: Dispatch | Dispatch[] | null;
};

const phases = ["booked", "boarding", "departed", "enroute", "landed", "completed"];

const actionLabels: Record<string, string> = {
  booked: "Start Flight",
  boarding: "Mark Departed",
  departed: "Mark Enroute",
  enroute: "Mark Landed",
  landed: "Complete Flight"
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

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function BookingConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{id: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const {id} = await params;
  const query = await searchParams;
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
        started_at,
        completed_at,
        route:routes(
          flight_number,
          scheduled_minutes,
          distance_nm,
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
          status,
          fleet_type:fleet_types(
            icao_code,
            manufacturer,
            model,
            cruise_speed_kts
          )
        ),
        dispatches(
          dispatch_number
        )
      `
    )
    .eq("id", id)
    .eq("pilot_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load booking: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  const booking = data as unknown as Booking;
  const route = first(booking.route);
  const aircraft = first(booking.aircraft);
  const fleetType = first(aircraft?.fleet_type);
  const dispatch = first(booking.dispatches);
  const departure = first(route?.departure);
  const arrival = first(route?.arrival);

  const currentIndex = phases.indexOf(booking.status);
  const actionLabel = actionLabels[booking.status];
  const isCompleted = booking.status === "completed";

  return (
    <main style={mainStyle}>
      <section style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <p className="eyebrow">Dispatch Package</p>
            <h1 style={titleStyle}>{route?.flight_number ?? "Flight"}</h1>
            <p style={routeStyle}>
              {departure?.icao_code ?? "—"} → {arrival?.icao_code ?? "—"}
            </p>
            <p style={mutedStyle}>
              {departure?.city ?? "Departure"} to {arrival?.city ?? "Arrival"}
            </p>
          </div>

          <div style={statusCardStyle}>
            <small style={labelStyle}>CURRENT STATUS</small>
            <strong style={statusValueStyle}>{booking.status}</strong>
          </div>
        </div>

        {query.error ? <div style={errorStyle}>{query.error}</div> : null}

        <div style={gridStyle}>
          <InfoCard label="Dispatch" value={dispatch?.dispatch_number ?? "Pending"} />
          <InfoCard label="Aircraft" value={aircraft?.registration ?? "Pending"} />
          <InfoCard
            label="Type"
            value={fleetType?.icao_code ?? "—"}
            subValue={
              fleetType
                ? `${fleetType.manufacturer} ${fleetType.model}`
                : "Aircraft type unavailable"
            }
          />
          <InfoCard label="Aircraft Status" value={aircraft?.status ?? "—"} />
          <InfoCard
            label="Block Time"
            value={formatDuration(route?.scheduled_minutes ?? null)}
          />
          <InfoCard
            label="Distance"
            value={
              route?.distance_nm
                ? `${route.distance_nm.toLocaleString("en-US")} NM`
                : "—"
            }
          />
          <InfoCard
            label="Cruise Speed"
            value={
              fleetType?.cruise_speed_kts
                ? `${fleetType.cruise_speed_kts.toLocaleString("en-US")} KT`
                : "—"
            }
          />
          <InfoCard label="Booked At" value={formatDate(booking.booked_at)} />
          <InfoCard label="Started At" value={formatDate(booking.started_at)} />
          <InfoCard label="Completed At" value={formatDate(booking.completed_at)} />
        </div>

        <section style={timelineStyle}>
          {phases.map((phase, index) => {
            const complete = currentIndex >= 0 && index <= currentIndex;
            const current = index === currentIndex;

            return (
              <div key={phase} style={timelineStepStyle}>
                <span
                  style={{
                    ...timelineDotStyle,
                    width: current ? 15 : 12,
                    height: current ? 15 : 12,
                    background: complete
                      ? "#00aeef"
                      : "rgba(255,255,255,.12)",
                    boxShadow: current
                      ? "0 0 0 5px rgba(0,174,239,.12)"
                      : "none"
                  }}
                />
                <small
                  style={{
                    color: complete ? "#fff" : "var(--muted)",
                    fontWeight: 800,
                    textTransform: "capitalize"
                  }}
                >
                  {phase}
                </small>
              </div>
            );
          })}
        </section>

        <div style={actionsStyle}>
          {actionLabel ? (
            <form action={advanceFlightAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className="button" type="submit">
                {actionLabel}
              </button>
            </form>
          ) : null}

          {isCompleted ? (
            <Link
              className="button"
              href={`/pilot/pireps/new?booking=${booking.id}`}
            >
              Submit PIREP
            </Link>
          ) : null}

          <Link className="button outline" href="/pilot/bookings">
            My Bookings
          </Link>

          <Link className="button outline" href="/pilot/dashboard">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  label,
  value,
  subValue
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div style={cardStyle}>
      <small style={labelStyle}>{label.toUpperCase()}</small>
      <strong style={valueStyle}>{value}</strong>
      {subValue ? <span style={subValueStyle}>{subValue}</span> : null}
    </div>
  );
}

const mainStyle = {
  minHeight: "calc(100vh - 80px)",
  padding: "84px 20px",
  background:
    "radial-gradient(circle at 75% 12%, rgba(0,174,239,.12), transparent 28%), var(--bg)"
} as const;

const panelStyle = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 38,
  border: "1px solid var(--border)",
  borderRadius: 24,
  background: "var(--surface)",
  boxShadow: "var(--shadow)"
} as const;

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 24,
  flexWrap: "wrap"
} as const;

const titleStyle = {
  margin: "12px 0 10px",
  fontSize: "clamp(3rem, 7vw, 5rem)",
  letterSpacing: "-.05em"
} as const;

const routeStyle = {
  margin: 0,
  fontSize: "1.45rem",
  fontWeight: 800
} as const;

const mutedStyle = {
  margin: "8px 0 0",
  color: "var(--muted)"
} as const;

const statusCardStyle = {
  minWidth: 190,
  padding: 18,
  border: "1px solid rgba(57,220,138,.22)",
  borderRadius: 16,
  background: "rgba(57,220,138,.08)"
} as const;

const statusValueStyle = {
  display: "block",
  marginTop: 8,
  color: "#82edb5",
  fontSize: "1.2rem",
  textTransform: "capitalize"
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
  margin: "32px 0"
} as const;

const cardStyle = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "rgba(4,16,32,.18)"
} as const;

const labelStyle = {
  color: "var(--muted)",
  fontWeight: 800,
  letterSpacing: ".08em"
} as const;

const valueStyle = {
  display: "block",
  marginTop: 8,
  fontSize: "1.15rem",
  textTransform: "capitalize"
} as const;

const subValueStyle = {
  display: "block",
  marginTop: 6,
  color: "var(--muted)",
  fontSize: ".84rem"
} as const;

const timelineStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(6, 1fr)",
  gap: 12,
  margin: "8px 0 30px",
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 16,
  background: "rgba(4,16,32,.18)"
} as const;

const timelineStepStyle = {
  display: "flex",
  alignItems: "center",
  gap: 9
} as const;

const timelineDotStyle = {
  flex: "0 0 auto",
  borderRadius: "50%"
} as const;

const actionsStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center"
} as const;

const errorStyle = {
  marginTop: 24,
  padding: 14,
  border: "1px solid rgba(255,95,95,.28)",
  borderRadius: 12,
  background: "rgba(255,95,95,.08)",
  color: "#ff9a9a"
} as const;

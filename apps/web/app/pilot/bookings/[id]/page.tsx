import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Airport = { icao_code: string; city: string | null };
type FleetType = { icao_code: string; manufacturer: string; model: string };
type Aircraft = {
  registration: string;
  status: string;
  fleet_type: FleetType | FleetType[] | null;
};
type Route = {
  flight_number: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};
type Dispatch = { dispatch_number: string };
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

export default async function BookingConfirmationPage({ params }: { params: Promise<{id: string}> }) {
  const {id} = await params;
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase
    .from("flight_bookings")
    .select(`
      id,
      status,
      booked_at,
      route:routes(
        flight_number,
        departure:airports!routes_departure_airport_id_fkey(icao_code, city),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code, city)
      ),
      aircraft:aircraft(
        registration,
        status,
        fleet_type:fleet_types(icao_code, manufacturer, model)
      ),
      dispatches(dispatch_number)
    `)
    .eq("id", id)
    .eq("pilot_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load booking: ${error.message}`);
  if (!data) notFound();

  const booking = data as unknown as Booking;
  const route = first(booking.route);
  const aircraft = first(booking.aircraft);
  const fleetType = first(aircraft?.fleet_type);
  const dispatch = first(booking.dispatches);
  const departure = first(route?.departure);
  const arrival = first(route?.arrival);

  return (
    <main style={{minHeight: "calc(100vh - 80px)", padding: "84px 20px", background: "radial-gradient(circle at 75% 12%, rgba(0,174,239,.12), transparent 28%), var(--bg)"}}>
      <section style={{maxWidth: 940, margin: "0 auto", padding: 38, border: "1px solid var(--border)", borderRadius: 24, background: "var(--surface)", boxShadow: "var(--shadow)"}}>
        <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap"}}>
          <div>
            <p className="eyebrow">Dispatch Package</p>
            <h1 style={{margin: "12px 0 10px", fontSize: "clamp(3rem, 7vw, 5rem)", letterSpacing: "-.05em"}}>{route?.flight_number ?? "Flight"}</h1>
            <p style={{margin: 0, fontSize: "1.45rem", fontWeight: 800}}>{departure?.icao_code ?? "—"} → {arrival?.icao_code ?? "—"}</p>
            <p style={{margin: "8px 0 0", color: "var(--muted)"}}>{departure?.city ?? "Departure"} to {arrival?.city ?? "Arrival"}</p>
          </div>

          <div style={{minWidth: 190, padding: 18, border: "1px solid rgba(57,220,138,.22)", borderRadius: 16, background: "rgba(57,220,138,.08)"}}>
            <small style={{color: "var(--muted)", fontWeight: 800, letterSpacing: ".08em"}}>CURRENT STATUS</small>
            <strong style={{display: "block", marginTop: 8, color: "#82edb5", fontSize: "1.2rem", textTransform: "capitalize"}}>{booking.status}</strong>
          </div>
        </div>

        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, margin: "32px 0"}}>
          <div style={cardStyle}>
            <small style={labelStyle}>DISPATCH</small>
            <strong style={valueStyle}>{dispatch?.dispatch_number ?? "Pending"}</strong>
          </div>
          <div style={cardStyle}>
            <small style={labelStyle}>AIRCRAFT</small>
            <strong style={valueStyle}>{aircraft?.registration ?? "Pending assignment"}</strong>
          </div>
          <div style={cardStyle}>
            <small style={labelStyle}>TYPE</small>
            <strong style={valueStyle}>{fleetType?.icao_code ?? "—"}</strong>
            <span style={subValueStyle}>{fleetType ? `${fleetType.manufacturer} ${fleetType.model}` : "Aircraft type unavailable"}</span>
          </div>
          <div style={cardStyle}>
            <small style={labelStyle}>AIRCRAFT STATUS</small>
            <strong style={{...valueStyle, textTransform: "capitalize"}}>{aircraft?.status ?? "—"}</strong>
          </div>
        </div>

        <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
          <Link className="button" href="/pilot/dashboard">Open dashboard</Link>
          <Link className="button outline" href="/pilot/flights">Browse flights</Link>
        </div>
      </section>
    </main>
  );
}

const cardStyle = {padding: 20, border: "1px solid var(--border)", borderRadius: 16, background: "rgba(4,16,32,.18)"} as const;
const labelStyle = {color: "var(--muted)", fontWeight: 800, letterSpacing: ".08em"} as const;
const valueStyle = {display: "block", marginTop: 8, fontSize: "1.15rem"} as const;
const subValueStyle = {display: "block", marginTop: 6, color: "var(--muted)", fontSize: ".84rem"} as const;

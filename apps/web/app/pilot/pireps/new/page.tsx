import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {submitPirepAction} from "./actions";

type Airport = {icao_code: string};
type Route = {
  flight_number: string;
  scheduled_minutes: number | null;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};
type Aircraft = {registration: string};
type Booking = {
  id: string;
  status: string;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function NewPirepPage({
  searchParams
}: {
  searchParams: Promise<{booking?: string; error?: string}>;
}) {
  const query = await searchParams;
  const bookingId = query.booking;

  if (!bookingId) redirect("/pilot/bookings");

  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase
    .from("flight_bookings")
    .select(`
      id,
      status,
      route:routes(
        flight_number,
        scheduled_minutes,
        departure:airports!routes_departure_airport_id_fkey(icao_code),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code)
      ),
      aircraft:aircraft(registration)
    `)
    .eq("id", bookingId)
    .eq("pilot_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load booking: ${error.message}`);
  if (!data) notFound();

  const booking = data as unknown as Booking;
  if (booking.status !== "completed") redirect(`/pilot/bookings/${booking.id}`);

  const route = first(booking.route);
  const departure = first(route?.departure)?.icao_code ?? "—";
  const arrival = first(route?.arrival)?.icao_code ?? "—";
  const aircraft = first(booking.aircraft)?.registration ?? "—";

  return (
    <main style={{minHeight:"calc(100vh - 80px)",padding:"76px 20px",background:"var(--bg)"}}>
      <section style={{maxWidth:820,margin:"0 auto",padding:34,border:"1px solid var(--border)",borderRadius:22,background:"var(--surface)"}}>
        <p className="eyebrow">Flight Records</p>
        <h1 style={{fontSize:"clamp(2.8rem,7vw,4.8rem)",margin:"10px 0"}}>Submit PIREP</h1>
        <p style={{color:"var(--muted)"}}>
          {route?.flight_number ?? "Flight"} · {departure} → {arrival} · {aircraft}
        </p>

        {query.error ? (
          <div style={{padding:14,margin:"22px 0",border:"1px solid rgba(255,95,95,.28)",borderRadius:12,color:"#ff9a9a",background:"rgba(255,95,95,.08)"}}>
            {query.error}
          </div>
        ) : null}

        <form action={submitPirepAction} style={{display:"grid",gap:18,marginTop:28}}>
          <input type="hidden" name="bookingId" value={booking.id} />

          <label style={labelStyle}>
            <span>Block Time (minutes)</span>
            <input
              style={inputStyle}
              type="number"
              name="blockMinutes"
              min={1}
              required
              defaultValue={route?.scheduled_minutes ?? 60}
            />
          </label>

          <label style={labelStyle}>
            <span>Landing Rate (ft/min)</span>
            <input style={inputStyle} type="number" name="landingRate" placeholder="-220" />
          </label>

          <label style={labelStyle}>
            <span>Fuel Used (kg)</span>
            <input style={inputStyle} type="number" name="fuelUsedKg" min={0} step="0.01" />
          </label>

          <label style={labelStyle}>
            <span>Remarks</span>
            <textarea style={{...inputStyle,minHeight:130,paddingTop:14}} name="remarks" />
          </label>

          <button className="button" type="submit">Submit PIREP</button>
        </form>
      </section>
    </main>
  );
}

const labelStyle = {display:"grid",gap:8,color:"var(--muted)",fontWeight:800} as const;
const inputStyle = {width:"100%",minHeight:48,padding:"0 14px",border:"1px solid var(--border)",borderRadius:11,background:"rgba(4,16,32,.42)",color:"inherit"} as const;

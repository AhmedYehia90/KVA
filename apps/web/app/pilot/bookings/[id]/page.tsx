import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type Airport = {icao_code: string};
type Route = {
  flight_number: string;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};
type Dispatch = {dispatch_number: string} | {dispatch_number: string}[] | null;
type Booking = {
  id: string;
  status: string;
  booked_at: string;
  route: Route | Route[] | null;
  dispatches: Dispatch;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function BookingConfirmationPage({
  params
}: {
  params: Promise<{id: string}>;
}) {
  const {id} = await params;
  const supabase = await createClient();
  const {
    data: {user}
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const {data, error} = await supabase
    .from("flight_bookings")
    .select(
      `
        id,
        status,
        booked_at,
        route:routes(
          flight_number,
          departure:airports!routes_departure_airport_id_fkey(icao_code),
          arrival:airports!routes_arrival_airport_id_fkey(icao_code)
        ),
        dispatches(dispatch_number)
      `
    )
    .eq("id", id)
    .eq("pilot_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Unable to load booking: ${error.message}`);
  if (!data) notFound();

  const booking = data as unknown as Booking;
  const route = first(booking.route);
  const departure = first(route?.departure)?.icao_code ?? "—";
  const arrival = first(route?.arrival)?.icao_code ?? "—";
  const dispatch = first(booking.dispatches)?.dispatch_number ?? "Pending";

  return (
    <main style={{padding: "90px 20px", minHeight: "70vh"}}>
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: 36,
          border: "1px solid var(--border)",
          borderRadius: 22,
          background: "var(--surface)",
          boxShadow: "var(--shadow)"
        }}
      >
        <p className="eyebrow">Booking Confirmed</p>
        <h1 style={{fontSize: "3.2rem", margin: "12px 0"}}>
          {route?.flight_number ?? "Flight"}
        </h1>
        <p style={{fontSize: "1.35rem", fontWeight: 800}}>
          {departure} → {arrival}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            margin: "28px 0"
          }}
        >
          <div style={{padding: 18, border: "1px solid var(--border)", borderRadius: 14}}>
            <small style={{color: "var(--muted)"}}>STATUS</small>
            <strong style={{display: "block", marginTop: 7, textTransform: "capitalize"}}>
              {booking.status}
            </strong>
          </div>
          <div style={{padding: 18, border: "1px solid var(--border)", borderRadius: 14}}>
            <small style={{color: "var(--muted)"}}>DISPATCH</small>
            <strong style={{display: "block", marginTop: 7}}>{dispatch}</strong>
          </div>
        </div>

        <Link className="button" href="/pilot/dashboard">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}

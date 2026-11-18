import {notFound, redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {formatScheduledTime} from "@/lib/scheduling/format";
import {bookScheduledFlight, cancelScheduledBooking} from "./actions";

type ScheduledFlight = {
  id: string; flight_number: string; departure: string; arrival: string;
  departure_at: string; arrival_at: string; display_timezone: string;
  registration: string; booked: boolean;
};
const activeStatuses = ["booked", "boarding", "departed", "enroute", "landed"];

export default async function ScheduledFlightsPage({searchParams}: {searchParams: Promise<{error?: string; message?: string}>}) {
  if (process.env.KVA_SCHEDULING_PHASE1_ENABLED !== "true") notFound();
  const locale = await getLocale();
  const ar = locale === "ar";
  const client = await createClient();
  const {data: {user}} = await client.auth.getUser();
  if (!user) redirect("/pilots/login");
  const [schedule, bookings] = await Promise.all([
    client.rpc("list_scheduled_flights"),
    client.from("flight_bookings").select("id, scheduled_flight_id, status").eq("pilot_id", user.id).in("status", activeStatuses)
  ]);
  const {error, message} = await searchParams;
  const unavailable = Boolean(schedule.error || bookings.error);
  const flights = unavailable ? [] : (schedule.data ?? []) as ScheduledFlight[];
  const ownBookings = bookings.data ?? [];
  return <main className="section" dir={ar ? "rtl" : "ltr"}><div className="container">
    <div className="eyebrow">{ar ? "عمليات الطيران" : "Flight operations"}</div>
    <h1>{ar ? "الرحلات المجدولة" : "Scheduled flights"}</h1>
    <p>{ar ? "اختر رحلة بتاريخ وموعد محددين. الأوقات معروضة بالمنطقة الزمنية الموضحة لكل رحلة." : "Choose a dated flight. Times use the timezone shown for each flight."}</p>
    {(unavailable || error) && <p role="alert">{ar ? "تعذر إتمام الطلب. حدّث القائمة وتحقق من توافر الرحلة." : "Unable to complete the request. Refresh and check flight availability."}</p>}
    {message === "booked" && <p role="status">{ar ? "تم تأكيد الحجز." : "Booking confirmed."}</p>}
    {message === "cancelled" && <p role="status">{ar ? "تم إلغاء الحجز." : "Booking cancelled."}</p>}
    {!unavailable && flights.length === 0 && <p>{ar ? "لا توجد رحلات مجدولة متاحة حاليًا." : "No scheduled flights are available."}</p>}
    <div className="grid">{flights.map(flight => {
      const own = ownBookings.find(b => b.scheduled_flight_id === flight.id);
      return <article className="card" key={flight.id}>
        <h2>{flight.flight_number}</h2>
        <p dir="ltr">{flight.departure} → {flight.arrival} · {flight.registration}</p>
        <p>{ar ? "المغادرة: " : "Departure: "}<time dateTime={flight.departure_at}>{formatScheduledTime(flight.departure_at, locale, flight.display_timezone)}</time></p>
        <p>{ar ? "الوصول: " : "Arrival: "}<time dateTime={flight.arrival_at}>{formatScheduledTime(flight.arrival_at, locale, flight.display_timezone)}</time></p>
        <p dir="ltr">{flight.display_timezone}</p>
        {own ? <>
          <Link href={`/pilot/bookings/${own.id}`}>{ar ? "عرض الحجز" : "View booking"}</Link>
          {own.status === "booked" && <form action={cancelScheduledBooking}><input type="hidden" name="bookingId" value={own.id}/><button className="button outline" type="submit">{ar ? "إلغاء الحجز" : "Cancel booking"}</button></form>}
        </> : flight.booked ? <p>{ar ? "محجوزة" : "Booked"}</p> : <form action={bookScheduledFlight}>
          <input type="hidden" name="scheduleId" value={flight.id}/>
          <button className="button" disabled={ownBookings.length > 0} type="submit">{ar ? "احجز الرحلة" : "Book flight"}</button>
        </form>}
      </article>;
    })}</div>
    <p><Link href="/pilot/bookings">{ar ? "حجوزاتي" : "My bookings"}</Link></p>
  </div></main>;
}

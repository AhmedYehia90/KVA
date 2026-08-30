import type {LucideIcon} from "lucide-react";
import {Bot, BriefcaseBusiness, Gauge, PlaneTakeoff, ShieldCheck, Trophy} from "lucide-react";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Airport = {
  icao_code: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  timezone: string | null;
};
type FleetType = {icao_code: string; manufacturer: string; model: string};
type Aircraft = {registration: string; fleet_type: FleetType | FleetType[] | null};
type Route = {
  flight_number: string;
  scheduled_minutes: number | null;
  distance_nm: number | null;
  departure: Airport | Airport[] | null;
  arrival: Airport | Airport[] | null;
};
type Dispatch = {dispatch_number: string; cruise_altitude: number | null};
type ActiveBooking = {
  id: string;
  status: string;
  booked_at: string;
  route: Route | Route[] | null;
  aircraft: Aircraft | Aircraft[] | null;
  dispatches: Dispatch | Dispatch[] | null;
};
type Profile = {
  callsign: string;
  full_name: string;
  total_hours: number | string | null;
  total_flights: number | null;
};
type CareerDashboard = {
  career?: {
    currentRankCode?: string;
    careerXp?: number;
    completedFlights?: number;
    flightMinutes?: number;
    nextRank?: {code?: string; minimumHours?: number; minimumFlights?: number} | null;
  };
  wallet?: {balance?: number};
};
type MentorSession = {
  opening_message: string;
  primary_focus_code: string;
  primary_focus: {title?: string} | null;
};
type OverviewCard = {
  label: string;
  value: string;
  detail: string;
  meta?: string;
  progress?: number;
  Icon: LucideIcon;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function airportPoint(airport: Airport | null) {
  if (airport?.longitude == null || airport.latitude == null) return null;
  const longitude = Number(airport?.longitude);
  const latitude = Number(airport?.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return {
    x: Math.max(10, Math.min(510, ((longitude + 180) / 360) * 520)),
    y: Math.max(10, Math.min(180, ((90 - latitude) / 180) * 190)),
  };
}

function MonitorFrame({children, className = ""}: {children: React.ReactNode; className?: string}) {
  return (
    <article className={`${styles.monitor} ${className}`}>
      <div className={styles.screen}>{children}</div>
      <span className={styles.monitorNeck} />
      <span className={styles.monitorFoot} />
    </article>
  );
}

function RouteMonitor({departure, arrival}: {departure: Airport | null; arrival: Airport | null}) {
  const from = airportPoint(departure);
  const to = airportPoint(arrival);
  const midX = from && to ? (from.x + to.x) / 2 : 260;
  const midY = from && to ? Math.min(from.y, to.y) - 12 : 95;
  return (
    <MonitorFrame className={styles.routeMonitor}>
      <p className={styles.kicker}>ROUTE MAP</p>
      <svg className={styles.worldMap} viewBox="0 0 520 190" aria-label={departure && arrival ? `Route from ${departure.icao_code} to ${arrival.icao_code}` : "No active route"}>
        <g className={styles.continents}>
          <path d="M26 66 47 47l35-13 30 6 19 17 26 5 13 16-17 10-15 22-20 4-10 25-17 24-7-40-17-14-22-2-9-17Z" />
          <path d="m155 49 22-17 46-5 18 10 28-2 20 14 25-2 23 13 30-7 22 13-13 15-30 5-21 18-21-4-16 19-10 31-19 17-9-41-19-12-20-30-28-12Z" />
          <path d="m365 110 23-9 21 7 12 14 31 8 18 18-16 15-31-4-16-23-30-6Z" />
          <path d="m198 113 25 9 22 24-5 25-19 12-14-21-18-12Z" />
        </g>
        <g className={styles.mapGrid}><path d="M0 42h520M0 92h520M0 142h520" /><path d="M90 0v190M190 0v190M290 0v190M390 0v190" /></g>
        {from && to ? (
          <>
            <path className={styles.flightPath} d={`M${from.x} ${from.y} Q${midX} ${midY} ${to.x} ${to.y}`} />
            <circle className={styles.cityGlow} cx={from.x} cy={from.y} r="7" />
            <circle className={styles.cityGlow} cx={to.x} cy={to.y} r="7" />
            <text className={styles.mapPlane} x={midX - 8} y={midY + 8}>✈</text>
          </>
        ) : <text className={styles.noRoute} x="260" y="104" textAnchor="middle">NO ACTIVE ROUTE</text>}
      </svg>
      <div className={styles.routeLabels}>
        <span><b>{departure?.icao_code ?? "—"}</b><small>{departure?.city ?? "No departure"}</small></span>
        <i><em />✈<em /></i>
        <span><b>{arrival?.icao_code ?? "—"}</b><small>{arrival?.city ?? "No arrival"}</small></span>
      </div>
    </MonitorFrame>
  );
}

function FlightMonitor({booking, route, aircraft, dispatch}: {booking: ActiveBooking | null; route: Route | null; aircraft: Aircraft | null; dispatch: Dispatch | null}) {
  const departure = first(route?.departure);
  const arrival = first(route?.arrival);
  const fleetType = first(aircraft?.fleet_type);
  return (
    <MonitorFrame className={styles.flightMonitor}>
      <p className={styles.kicker}>FLIGHT PLAN</p>
      <h2>{route ? `${departure?.icao_code ?? "—"} → ${arrival?.icao_code ?? "—"}` : "NO ACTIVE FLIGHT"}</h2>
      <strong className={styles.ready}>{booking ? humanize(booking.status) : "AWAITING ASSIGNMENT"}</strong>
      <div className={styles.flightFacts}>
        <span><small>DISTANCE</small><b>{route?.distance_nm ? `${route.distance_nm.toLocaleString("en-US")} NM` : "—"}</b></span>
        <span><small>FLIGHT TIME</small><b>{formatDuration(route?.scheduled_minutes)}</b></span>
        <span><small>CRZ ALT</small><b>{dispatch?.cruise_altitude ? `FL${Math.round(dispatch.cruise_altitude / 100)}` : "—"}</b></span>
        <span><small>DISPATCH</small><b>{dispatch?.dispatch_number ?? "Pending"}</b></span>
      </div>
      <div className={styles.planeProfile}><span /><svg viewBox="0 0 110 42" aria-hidden="true"><path fill="#dcebf4" d="M54 2h4l4 14 39 9v4l-39-3-4 13h-4l-5-13-40 3v-4l40-9Z" /></svg><span /></div>
      <p className={styles.aircraftType}>{aircraft?.registration ?? fleetType?.icao_code ?? "AIRCRAFT PENDING"}</p>
    </MonitorFrame>
  );
}

function AirportMonitor({airport}: {airport: Airport | null}) {
  const latitude = airport?.latitude == null ? "—" : `${Number(airport.latitude).toFixed(2)}°`;
  const longitude = airport?.longitude == null ? "—" : `${Number(airport.longitude).toFixed(2)}°`;
  return (
    <MonitorFrame className={styles.weatherMonitor}>
      <p className={styles.kicker}>WEATHER OVERVIEW</p>
      <div className={styles.weatherGrid}>
        <div className={styles.weatherNow}>
          <span className={styles.weatherGlyph}>◉</span>
          <span><small>{airport?.icao_code ?? "—"} · DEPARTURE</small><b>{airport?.city ?? "No airport"}</b><em>{airport?.name ?? "No active assignment"}</em></span>
        </div>
        <dl><div><dt>LAT</dt><dd>{latitude}</dd></div><div><dt>LON</dt><dd>{longitude}</dd></div><div><dt>ZONE</dt><dd>{airport?.timezone ?? "—"}</dd></div></dl>
      </div>
      <div className={styles.notams}><b>LIVE WEATHER</b><span>Weather feed not connected</span></div>
    </MonitorFrame>
  );
}

export default async function PilotOfficePage() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/pilots/login");

  const [profileResult, bookingResult, careerResult, achievementsResult, mentorResult] = await Promise.all([
    supabase.from("profiles").select("callsign,full_name,total_hours,total_flights").eq("id", user.id).single(),
    supabase.from("flight_bookings").select(`
      id,status,booked_at,
      route:routes(
        flight_number,scheduled_minutes,distance_nm,
        departure:airports!routes_departure_airport_id_fkey(icao_code,name,city,country,latitude,longitude,timezone),
        arrival:airports!routes_arrival_airport_id_fkey(icao_code,name,city,country,latitude,longitude,timezone)
      ),
      aircraft:aircraft(registration,fleet_type:fleet_types(icao_code,manufacturer,model)),
      dispatches(dispatch_number,cruise_altitude)
    `).eq("pilot_id", user.id).in("status", ["booked", "boarding", "departed", "enroute", "landed"]).order("booked_at", {ascending: false}).limit(1).maybeSingle(),
    supabase.rpc("get_pilot_career_economy_dashboard"),
    supabase.from("global_aviation_event_achievements").select("id", {count: "exact", head: true}).eq("pilot_id", user.id),
    supabase.from("mentor_ai_sessions").select("opening_message,primary_focus_code,primary_focus").eq("pilot_id", user.id).order("created_at", {ascending: false}).limit(1).maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(`Unable to load Pilot Office profile: ${profileResult.error?.message ?? "Profile not found"}`);
  }

  const profile = profileResult.data as unknown as Profile;
  const booking = bookingResult.error ? null : bookingResult.data as unknown as ActiveBooking | null;
  const route = first(booking?.route);
  const aircraft = first(booking?.aircraft);
  const dispatch = first(booking?.dispatches);
  const departure = first(route?.departure);
  const arrival = first(route?.arrival);
  const careerDashboard = careerResult.error ? null : careerResult.data as unknown as CareerDashboard | null;
  const career = careerDashboard?.career;
  const wallet = careerDashboard?.wallet;
  const mentor = mentorResult.error ? null : mentorResult.data as unknown as MentorSession | null;
  const totalHours = numberValue(profile.total_hours) || numberValue(career?.flightMinutes) / 60;
  const completedFlights = numberValue(career?.completedFlights) || numberValue(profile.total_flights);
  const nextRank = career?.nextRank;
  const hourProgress = nextRank?.minimumHours ? totalHours / nextRank.minimumHours : 1;
  const flightProgress = nextRank?.minimumFlights ? completedFlights / nextRank.minimumFlights : 1;
  const careerProgress = nextRank ? Math.round(Math.min(1, hourProgress, flightProgress) * 100) : 100;
  const currency = new Intl.NumberFormat("en-US").format(numberValue(wallet?.balance));
  const mentorTitle = mentor?.primary_focus?.title ?? (mentor?.primary_focus_code ? humanize(mentor.primary_focus_code) : "Ready to assist");

  const overview: OverviewCard[] = [
    {label: "Next Flight", value: route ? `${departure?.icao_code ?? "—"} → ${arrival?.icao_code ?? "—"}` : "No active flight", detail: route ? `${departure?.city ?? "Departure"} → ${arrival?.city ?? "Arrival"}` : "Browse available flights", meta: booking && route ? `${route.flight_number} · ${humanize(booking.status)}` : "—", Icon: PlaneTakeoff},
    {label: "Career Progress", value: career?.currentRankCode ?? "—", detail: nextRank ? `${Math.round(completedFlights)} flights · Next ${nextRank.code ?? "rank"}` : "Top rank", progress: careerProgress, Icon: BriefcaseBusiness},
    {label: "KVA Credits", value: `${currency} KVC`, detail: "Wallet Balance", Icon: ShieldCheck},
    {label: "Flight Hours", value: totalHours.toFixed(1), detail: "Total on KVA OS", Icon: Gauge},
    {label: "Achievements", value: String(achievementsResult.error ? 0 : achievementsResult.count ?? 0), detail: "Badges Earned", Icon: Trophy},
    {label: "Mentor AI", value: mentorTitle, detail: mentor?.opening_message ?? "Ready to assist you", Icon: Bot},
  ];

  return (
    <main className={styles.page} data-kva-pilot-office-visual-parity>
      <section className={styles.office} aria-label="Pilot Office">
        <div className={styles.window} aria-label="Night airport visible through the office windows"><span className={styles.windowShade} /><span className={styles.windowFrameOne} /><span className={styles.windowFrameTwo} /></div>
        <aside className={styles.brandWall} aria-label="Kalabsha Airlines Pilot Office" />
        <div className={styles.displayShelf} aria-hidden="true"><span className={styles.shelfLight} /><span className={styles.books} /><span className={styles.plant} /><span className={styles.shelfLight} /></div>
        <img className={styles.referenceForeground} src="/pilot-office/office-reference.png" alt="" aria-hidden="true" draggable={false} />
        <div className={styles.monitorBank}><RouteMonitor departure={departure} arrival={arrival} /><FlightMonitor booking={booking} route={route} aircraft={aircraft} dispatch={dispatch} /><AirportMonitor airport={departure} /></div>
        <section className={styles.stats} aria-label="Live pilot overview">
          {overview.map(({Icon, ...card}) => <article className={styles.statCard} key={card.label}>
            <span className={styles.statIcon}><Icon size={18} color="#08b9ff" strokeWidth={1.8} /></span><small>{card.label}</small><strong title={card.value}>{card.value}</strong><p title={card.detail}>{card.detail}</p>
            {card.meta && <em>{card.meta}</em>}{card.progress !== undefined && <div className={styles.progress}><i style={{width: `${card.progress}%`}} /><span>{card.progress}%</span></div>}
          </article>)}
        </section>
      </section>
    </main>
  );
}

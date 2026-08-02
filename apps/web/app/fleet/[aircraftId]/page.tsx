import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
  range_nm: number | null;
  cruise_speed_kts: number | null;
  max_passengers: number | null;
};

type Airport = {
  icao_code: string;
  name: string;
  city: string | null;
};

type Pilot = {
  callsign: string;
  full_name: string;
};

type Aircraft = {
  id: string;
  registration: string;
  status: string;
  flight_hours: number | string;
  assigned_pilot_id: string | null;
  livery_version: string;
  notes: string | null;
  fleet_type: FleetType | FleetType[] | null;
  current_airport: Airport | Airport[] | null;
  assigned_pilot: Pilot | Pilot[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AircraftDetailsPage({
  params
}: {
  params: Promise<{aircraftId: string}>;
}) {
  const {aircraftId} = await params;
  const registration = decodeURIComponent(aircraftId).trim().toUpperCase();
  const supabase = await createClient();

  const {data, error} = await supabase
    .from("aircraft")
    .select(`
      id,
      registration,
      status,
      flight_hours,
      assigned_pilot_id,
      livery_version,
      notes,
      fleet_type:fleet_types(
        icao_code,
        manufacturer,
        model,
        range_nm,
        cruise_speed_kts,
        max_passengers
      ),
      current_airport:airports!aircraft_current_airport_id_fkey(
        icao_code,
        name,
        city
      ),
      assigned_pilot:profiles!aircraft_assigned_pilot_id_fkey(
        callsign,
        full_name
      )
    `)
    .eq("registration", registration)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load aircraft: ${error.message}`);
  }

  if (!data) notFound();

  const aircraft = data as unknown as Aircraft;
  const fleetType = first(aircraft.fleet_type);
  const airport = first(aircraft.current_airport);
  const pilot = first(aircraft.assigned_pilot);
  const available =
    aircraft.status === "active" && !aircraft.assigned_pilot_id;

  return (
    <main style={{minHeight:"calc(100vh - 80px)",padding:"76px 20px 100px",background:"var(--bg)"}}>
      <section style={{maxWidth:980,margin:"0 auto"}}>
        <Link href="/fleet" style={{color:"var(--accent)",fontWeight:800}}>
          ← Fleet overview
        </Link>

        <div style={{display:"flex",justifyContent:"space-between",gap:24,alignItems:"flex-start",flexWrap:"wrap",margin:"26px 0 30px"}}>
          <div>
            <p className="eyebrow">Aircraft Details</p>
            <h1 style={{fontSize:"clamp(3rem,7vw,5.5rem)",margin:"10px 0"}}>
              {aircraft.registration}
            </h1>
            <p style={{margin:0,color:"var(--muted)",fontSize:"1.15rem"}}>
              {fleetType
                ? `${fleetType.manufacturer} ${fleetType.model} · ${fleetType.icao_code}`
                : "Unknown aircraft type"}
            </p>
          </div>

          <span style={{
            padding:"11px 14px",
            borderRadius:999,
            fontWeight:900,
            background:available ? "rgba(57,220,138,.1)" : "rgba(0,174,239,.1)",
            color:available ? "#82edb5" : "#74d8ff"
          }}>
            {available ? "Available" : aircraft.status === "active" ? "Assigned" : aircraft.status}
          </span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14}}>
          <Info label="Registration" value={aircraft.registration} />
          <Info label="Aircraft Type" value={fleetType?.icao_code ?? "—"} />
          <Info label="Manufacturer" value={fleetType?.manufacturer ?? "—"} />
          <Info label="Model" value={fleetType?.model ?? "—"} />
          <Info label="Status" value={available ? "Available" : aircraft.status} />
          <Info
            label="Current Airport"
            value={airport?.icao_code ?? "Not set"}
            subValue={airport?.name ?? undefined}
          />
          <Info
            label="Assigned Pilot"
            value={pilot?.full_name ?? "None"}
            subValue={pilot?.callsign ?? undefined}
          />
          <Info
            label="Flight Hours"
            value={`${Number(aircraft.flight_hours ?? 0).toFixed(1)} h`}
          />
          <Info
            label="Range"
            value={fleetType?.range_nm ? `${fleetType.range_nm.toLocaleString("en-US")} NM` : "—"}
          />
          <Info
            label="Cruise Speed"
            value={fleetType?.cruise_speed_kts ? `${fleetType.cruise_speed_kts} KT` : "—"}
          />
          <Info
            label="Passengers"
            value={fleetType?.max_passengers?.toString() ?? "—"}
          />
          <Info label="Livery Version" value={aircraft.livery_version} />
        </div>

        {aircraft.notes ? (
          <section style={{marginTop:22,padding:22,border:"1px solid var(--border)",borderRadius:18,background:"var(--surface)"}}>
            <p className="eyebrow">Notes</p>
            <p style={{color:"var(--muted)",lineHeight:1.7}}>{aircraft.notes}</p>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Info({
  label,
  value,
  subValue
}: {
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <article style={{padding:20,border:"1px solid var(--border)",borderRadius:16,background:"var(--surface)"}}>
      <small style={{color:"var(--muted)",fontWeight:800,letterSpacing:".08em"}}>
        {label.toUpperCase()}
      </small>
      <strong style={{display:"block",marginTop:8,fontSize:"1.1rem",textTransform:"capitalize"}}>
        {value}
      </strong>
      {subValue ? (
        <span style={{display:"block",marginTop:5,color:"var(--muted)",fontSize:".82rem"}}>
          {subValue}
        </span>
      ) : null}
    </article>
  );
}

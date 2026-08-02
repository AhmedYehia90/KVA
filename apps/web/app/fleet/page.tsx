import Link from "next/link";
import {createClient} from "@/lib/supabase/server";

type FleetType = {
  icao_code: string;
  manufacturer: string;
  model: string;
};

type Aircraft = {
  registration: string;
  status: string;
  flight_hours: number | string;
  assigned_pilot_id: string | null;
  fleet_type: FleetType | FleetType[] | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function FleetPage() {
  const supabase = await createClient();

  const {data, error} = await supabase
    .from("aircraft")
    .select(`
      registration,
      status,
      flight_hours,
      assigned_pilot_id,
      fleet_type:fleet_types(
        icao_code,
        manufacturer,
        model
      )
    `)
    .order("registration", {ascending: true});

  if (error) {
    throw new Error(`Unable to load fleet: ${error.message}`);
  }

  const aircraft = (data ?? []) as unknown as Aircraft[];

  const totalAircraft = aircraft.length;
  const operationalAircraft = aircraft.filter(
    (item) => item.status === "active"
  );
  const availableAircraft = operationalAircraft.filter(
    (item) => !item.assigned_pilot_id
  ).length;
  const assignedAircraft = operationalAircraft.filter(
    (item) => Boolean(item.assigned_pilot_id)
  ).length;
  const maintenanceAircraft = aircraft.filter(
    (item) => item.status === "maintenance"
  ).length;
  const groundedAircraft = aircraft.filter(
    (item) => item.status === "grounded"
  ).length;
  const retiredAircraft = aircraft.filter(
    (item) => item.status === "retired"
  ).length;

  const grouped = new Map<
    string,
    {
      icaoCode: string;
      manufacturer: string;
      model: string;
      total: number;
      available: number;
      assigned: number;
      maintenance: number;
      grounded: number;
      retired: number;
      aircraft: Aircraft[];
    }
  >();

  for (const item of aircraft) {
    const fleetType = first(item.fleet_type);
    const key = fleetType?.icao_code ?? "UNKNOWN";

    const current = grouped.get(key) ?? {
      icaoCode: key,
      manufacturer: fleetType?.manufacturer ?? "Unknown",
      model: fleetType?.model ?? "Unknown type",
      total: 0,
      available: 0,
      assigned: 0,
      maintenance: 0,
      grounded: 0,
      retired: 0,
      aircraft: []
    };

    current.total += 1;
    current.aircraft.push(item);

    if (item.status === "active" && !item.assigned_pilot_id) {
      current.available += 1;
    } else if (item.status === "active" && item.assigned_pilot_id) {
      current.assigned += 1;
    } else if (item.status === "maintenance") {
      current.maintenance += 1;
    } else if (item.status === "grounded") {
      current.grounded += 1;
    } else if (item.status === "retired") {
      current.retired += 1;
    }

    grouped.set(key, current);
  }

  const fleetTypes = Array.from(grouped.values()).sort((a, b) =>
    a.icaoCode.localeCompare(b.icaoCode)
  );

  return (
    <main style={mainStyle}>
      <section style={heroStyle}>
        <div className="container">
          <p className="eyebrow">Fleet Management</p>
          <h1 style={heroTitleStyle}>Fleet Overview</h1>
          <p style={heroTextStyle}>
            Live aircraft totals and availability from the Kalabsha Airlines database.
          </p>
        </div>
      </section>

      <section style={contentStyle}>
        <div className="container">
          <div style={statsGridStyle}>
            <StatCard label="Total Aircraft" value={totalAircraft} />
            <StatCard label="Available" value={availableAircraft} tone="good" />
            <StatCard label="Assigned" value={assignedAircraft} tone="info" />
            <StatCard label="Maintenance" value={maintenanceAircraft} tone="warn" />
            <StatCard label="Grounded" value={groundedAircraft} tone="bad" />
            <StatCard label="Retired" value={retiredAircraft} />
          </div>

          <div style={sectionHeadingStyle}>
            <div>
              <p className="eyebrow">Aircraft Types</p>
              <h2 style={sectionTitleStyle}>{fleetTypes.length} fleet types</h2>
            </div>
            <span style={mutedStyle}>
              In this system, aircraft status <strong>active</strong> means operational.
            </span>
          </div>

          <div style={typeGridStyle}>
            {fleetTypes.map((type) => (
              <article key={type.icaoCode} style={typeCardStyle}>
                <div style={typeTopStyle}>
                  <div>
                    <span style={typeCodeStyle}>{type.icaoCode}</span>
                    <h2 style={typeNameStyle}>
                      {type.manufacturer} {type.model}
                    </h2>
                  </div>
                  <strong style={typeCountStyle}>{type.total}</strong>
                </div>

                <div style={miniStatsStyle}>
                  <MiniStat label="Available" value={type.available} />
                  <MiniStat label="Assigned" value={type.assigned} />
                  <MiniStat label="Maintenance" value={type.maintenance} />
                </div>

                <div style={aircraftListStyle}>
                  {type.aircraft.map((item) => {
                    const available =
                      item.status === "active" && !item.assigned_pilot_id;

                    return (
                      <Link
                        key={item.registration}
                        href={`/fleet/${encodeURIComponent(item.registration)}`}
                        style={aircraftRowStyle}
                      >
                        <div>
                          <strong>{item.registration}</strong>
                          <span style={hoursStyle}>
                            {toNumber(item.flight_hours).toFixed(1)} hours
                          </span>
                        </div>

                        <span
                          style={{
                            ...statusPillStyle,
                            ...(available
                              ? availablePillStyle
                              : item.status === "maintenance"
                                ? maintenancePillStyle
                                : assignedPillStyle)
                          }}
                        >
                          {available
                            ? "Available"
                            : item.status === "active"
                              ? "Assigned"
                              : item.status}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "good" | "info" | "warn" | "bad";
}) {
  const border =
    tone === "good"
      ? "rgba(57,220,138,.25)"
      : tone === "info"
        ? "rgba(0,174,239,.25)"
        : tone === "warn"
          ? "rgba(255,187,72,.25)"
          : tone === "bad"
            ? "rgba(255,95,95,.25)"
            : "var(--border)";

  return (
    <article style={{...statCardStyle, borderColor: border}}>
      <span style={statLabelStyle}>{label}</span>
      <strong style={statValueStyle}>{value}</strong>
    </article>
  );
}

function MiniStat({label, value}: {label: string; value: number}) {
  return (
    <div style={miniStatStyle}>
      <span style={miniLabelStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const mainStyle = {minHeight: "100vh", background: "var(--bg)"} as const;
const heroStyle = {
  padding: "76px 0 106px",
  background:
    "radial-gradient(circle at 78% 30%, rgba(0,174,239,.22), transparent 28%), linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)"
} as const;
const heroTitleStyle = {
  margin: "14px 0 18px",
  fontSize: "clamp(3.2rem,7vw,6rem)",
  lineHeight: .95,
  letterSpacing: "-.055em"
} as const;
const heroTextStyle = {
  maxWidth: 720,
  margin: 0,
  color: "var(--muted)",
  fontSize: "1.05rem",
  lineHeight: 1.8
} as const;
const contentStyle = {padding: "0 0 100px"} as const;
const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: 14,
  transform: "translateY(-38px)"
} as const;
const statCardStyle = {
  padding: 22,
  border: "1px solid var(--border)",
  borderRadius: 18,
  background: "rgba(13,44,84,.98)",
  boxShadow: "var(--shadow)"
} as const;
const statLabelStyle = {
  display: "block",
  color: "var(--muted)",
  fontSize: ".76rem",
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase"
} as const;
const statValueStyle = {
  display: "block",
  marginTop: 10,
  fontSize: "2rem"
} as const;
const sectionHeadingStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 24,
  flexWrap: "wrap",
  margin: "4px 0 24px"
} as const;
const sectionTitleStyle = {
  margin: "9px 0 0",
  fontSize: "clamp(1.8rem,3vw,2.5rem)"
} as const;
const mutedStyle = {color: "var(--muted)", fontSize: ".9rem"} as const;
const typeGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 20
} as const;
const typeCardStyle = {
  padding: 24,
  border: "1px solid var(--border)",
  borderRadius: 20,
  background: "var(--surface)"
} as const;
const typeTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start"
} as const;
const typeCodeStyle = {
  color: "var(--accent)",
  fontWeight: 900,
  letterSpacing: ".12em"
} as const;
const typeNameStyle = {margin: "7px 0 0", fontSize: "1.45rem"} as const;
const typeCountStyle = {fontSize: "2.2rem"} as const;
const miniStatsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 10,
  margin: "22px 0"
} as const;
const miniStatStyle = {
  padding: 13,
  border: "1px solid rgba(105,183,231,.14)",
  borderRadius: 12,
  background: "rgba(4,16,32,.22)"
} as const;
const miniLabelStyle = {
  display: "block",
  marginBottom: 6,
  color: "var(--muted)",
  fontSize: ".7rem",
  fontWeight: 800,
  textTransform: "uppercase"
} as const;
const aircraftListStyle = {display: "grid", gap: 10} as const;
const aircraftRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: 14,
  border: "1px solid rgba(105,183,231,.13)",
  borderRadius: 12,
  background: "rgba(4,16,32,.18)"
} as const;
const hoursStyle = {
  display: "block",
  marginTop: 4,
  color: "var(--muted)",
  fontSize: ".78rem"
} as const;
const statusPillStyle = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: ".75rem",
  fontWeight: 800,
  textTransform: "capitalize"
} as const;
const availablePillStyle = {
  background: "rgba(57,220,138,.1)",
  color: "#82edb5"
} as const;
const assignedPillStyle = {
  background: "rgba(0,174,239,.1)",
  color: "#74d8ff"
} as const;
const maintenancePillStyle = {
  background: "rgba(255,187,72,.1)",
  color: "#ffd584"
} as const;

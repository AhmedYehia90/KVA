import Image from "next/image";
import Link from "next/link";
import {createAdminClient} from "@/lib/supabase/admin";
import styles from "./FleetPremium.module.css";

export const dynamic = "force-dynamic";

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

function statusClass(status: string, available: boolean) {
  if (available) return `${styles.statusPill} ${styles.statusAvailable}`;
  if (status === "active") return `${styles.statusPill} ${styles.statusAssigned}`;
  if (status === "maintenance") return `${styles.statusPill} ${styles.statusMaintenance}`;
  if (status === "grounded") return `${styles.statusPill} ${styles.statusGrounded}`;
  return `${styles.statusPill} ${styles.statusRetired}`;
}

export default async function FleetPage() {
  const supabase = createAdminClient();

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
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow">Fleet Management</p>
          <h1 className={styles.heroTitle}>Fleet Overview</h1>
          <p className={styles.heroText}>
            Live aircraft totals and availability from the Kalabsha Airlines database.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className="container">
          <div className={styles.statsGrid}>
            <StatCard label="Total Aircraft" value={totalAircraft} />
            <StatCard label="Available" value={availableAircraft} tone="good" />
            <StatCard label="Assigned" value={assignedAircraft} tone="info" />
            <StatCard label="Maintenance" value={maintenanceAircraft} tone="warn" />
            <StatCard label="Grounded" value={groundedAircraft} tone="bad" />
            <StatCard label="Retired" value={retiredAircraft} />
          </div>

          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Aircraft Types</p>
              <h2 className={styles.sectionTitle}>{fleetTypes.length} fleet types</h2>
            </div>
            <span className={styles.muted}>
              In this system, aircraft status <strong>active</strong> means operational.
            </span>
          </div>

          <div className={styles.typeGrid}>
            {fleetTypes.map((type) => (
              <article key={type.icaoCode} className={styles.typeCard}>
                <FleetArtwork icaoCode={type.icaoCode} />
                <div className={styles.typeTop}>
                  <div>
                    <span className={styles.typeCode}>{type.icaoCode}</span>
                    <h2 className={styles.typeName}>
                      {type.manufacturer} {type.model}
                    </h2>
                  </div>
                  <strong className={styles.typeCount}>{type.total}</strong>
                </div>

                <div className={styles.miniStats}>
                  <MiniStat label="Available" value={type.available} />
                  <MiniStat label="Assigned" value={type.assigned} />
                  <MiniStat label="Maintenance" value={type.maintenance} />
                </div>

                <div className={styles.aircraftList}>
                  {type.aircraft.map((item) => {
                    const available =
                      item.status === "active" && !item.assigned_pilot_id;

                    return (
                      <Link
                        key={item.registration}
                        href={`/fleet/${encodeURIComponent(item.registration)}`}
                        className={styles.aircraftRow}
                      >
                        <div>
                          <strong>{item.registration}</strong>
                          <span className={styles.hours}>
                            {toNumber(item.flight_hours).toFixed(1)} hours
                          </span>
                        </div>

                        <span className={statusClass(item.status, available)}>
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


type FleetArtworkDefinition = {
  src: string;
  alt: string;
};

const fleetArtworkByIcao: Record<string, FleetArtworkDefinition> = {
  B748: {src: "/fleet/official/b747-8.webp", alt: "Kalabsha Airlines Boeing 747-8 at Aswan International Airport"},
  B747: {src: "/fleet/official/b747-8.webp", alt: "Kalabsha Airlines Boeing 747-8 at Aswan International Airport"},
  A359: {src: "/fleet/official/a350-900.webp", alt: "Kalabsha Airlines Airbus A350-900 at Aswan International Airport"},
  E170: {src: "/fleet/official/e170.webp", alt: "Kalabsha Airlines Embraer E170 at Aswan International Airport"},
  A21N: {src: "/fleet/official/a321neo.webp", alt: "Kalabsha Airlines Airbus A321neo at Aswan International Airport"},
  A321: {src: "/fleet/official/a321neo.webp", alt: "Kalabsha Airlines Airbus A321neo at Aswan International Airport"},
  A333: {src: "/fleet/official/a330-300.webp", alt: "Kalabsha Airlines Airbus A330-300 at Aswan International Airport"},
  A330: {src: "/fleet/official/a330-300.webp", alt: "Kalabsha Airlines Airbus A330 at Aswan International Airport"},
  B788: {src: "/fleet/official/b787-8.webp", alt: "Kalabsha Airlines Boeing 787-8 Dreamliner at Aswan International Airport"},
  B789: {src: "/fleet/official/b787-9.webp", alt: "Kalabsha Airlines Boeing 787-9 at Aswan International Airport"},
  B787: {src: "/fleet/official/b787-9.webp", alt: "Kalabsha Airlines Boeing 787 at Aswan International Airport"},
  B77W: {src: "/fleet/official/b777-300er.webp", alt: "Kalabsha Airlines Boeing 777-300ER at Aswan International Airport"},
  B773: {src: "/fleet/official/b777-300er.webp", alt: "Kalabsha Airlines Boeing 777-300ER at Aswan International Airport"}
};

function FleetArtwork({icaoCode}: {icaoCode: string}) {
  const artwork = fleetArtworkByIcao[icaoCode.trim().toUpperCase()];

  if (!artwork) {
    return null;
  }

  return (
    <div style={fleetArtworkBlockStyle}>
      <span style={fleetArtworkBadgeStyle}>Official Kalabsha Fleet</span>

      <div style={fleetArtworkFrameStyle}>
        <Image
          src={artwork.src}
          alt={artwork.alt}
          width={2048}
          height={1156}
          sizes="(max-width: 760px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={fleetArtworkImageStyle}
        />
      </div>
    </div>
  );
}

const fleetArtworkBlockStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "100%",
  marginBottom: 18
} as const;

const fleetArtworkFrameStyle = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  marginBottom: 0,
  border: "1px solid rgba(82,190,255,.2)",
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(3,13,25,.55)"
} as const;

const fleetArtworkImageStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center center"
} as const;

const fleetArtworkBadgeStyle = {
  position: "static",
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  marginBottom: 10,
  padding: "6px 10px",
  border: "1px solid rgba(78,205,255,.34)",
  borderRadius: 999,
  background: "rgba(2,13,25,.72)",
  color: "#79dcff",
  fontSize: ".65rem",
  fontWeight: 900,
  letterSpacing: ".08em",
  lineHeight: 1.2,
  textTransform: "uppercase"
} as const;
function StatCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "good" | "info" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? styles.toneGood
      : tone === "info"
        ? styles.toneInfo
        : tone === "warn"
          ? styles.toneWarn
          : tone === "bad"
            ? styles.toneBad
            : "";

  return (
    <article className={`${styles.statCard} ${toneClass}`}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
    </article>
  );
}

function MiniStat({label, value}: {label: string; value: number}) {
  return (
    <div className={styles.miniStat}>
      <span className={styles.miniLabel}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

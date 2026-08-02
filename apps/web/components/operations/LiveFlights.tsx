import Link from "next/link";

type LiveFlight = {
  id: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  registration: string;
  aircraftType: string;
  pilotName: string;
  callsign: string;
  status: string;
  startedAt: string | null;
};

export function LiveFlights({flights}: {flights: LiveFlight[]}) {
  return (
    <section style={panelStyle}>
      <div style={headingStyle}>
        <div>
          <p className="eyebrow">Live Operations</p>
          <h2 style={titleStyle}>Active Flights</h2>
        </div>
        <Link href="/live-flights" style={linkStyle}>
          View public board →
        </Link>
      </div>

      {flights.length ? (
        <div style={listStyle}>
          {flights.map((flight) => (
            <article key={flight.id} style={rowStyle}>
              <div>
                <strong>{flight.flightNumber}</strong>
                <span style={subStyle}>
                  {flight.departure} → {flight.arrival}
                </span>
              </div>
              <div>
                <strong>{flight.registration}</strong>
                <span style={subStyle}>{flight.aircraftType}</span>
              </div>
              <div>
                <strong>{flight.pilotName}</strong>
                <span style={subStyle}>{flight.callsign}</span>
              </div>
              <span style={statusStyle}>{flight.status}</span>
            </article>
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>
          <h3 style={{marginTop: 0}}>No active flights</h3>
          <p style={{marginBottom: 0, color: "var(--muted)"}}>
            Boarding, departed, enroute and landed flights will appear here.
          </p>
        </div>
      )}
    </section>
  );
}

const panelStyle = {
  padding: 26,
  border: "1px solid var(--border)",
  borderRadius: 22,
  background: "var(--surface)"
} as const;

const headingStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 20,
  flexWrap: "wrap"
} as const;

const titleStyle = {margin: "9px 0 0", fontSize: "2rem"} as const;
const linkStyle = {color: "var(--accent)", fontWeight: 800} as const;
const listStyle = {display: "grid", gap: 10, marginTop: 22} as const;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1.3fr auto",
  gap: 16,
  alignItems: "center",
  padding: 16,
  border: "1px solid rgba(105,183,231,.14)",
  borderRadius: 14,
  background: "rgba(4,16,32,.18)"
} as const;

const subStyle = {
  display: "block",
  marginTop: 4,
  color: "var(--muted)",
  fontSize: ".8rem"
} as const;

const statusStyle = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(0,174,239,.1)",
  color: "#74d8ff",
  fontWeight: 800,
  textTransform: "capitalize"
} as const;

const emptyStyle = {
  marginTop: 22,
  padding: 28,
  border: "1px dashed var(--border)",
  borderRadius: 16,
  textAlign: "center"
} as const;

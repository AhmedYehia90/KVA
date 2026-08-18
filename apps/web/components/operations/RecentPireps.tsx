import Link from "next/link";

type PirepItem = {
  id: string;
  code: string;
  flightNumber: string;
  blockMinutes: number;
  landingRate: number | null;
  status: string;
  createdAt: string;
  pilotName: string;
  callsign: string;
};

export function RecentPireps({items}: {items: PirepItem[]}) {
  return (
    <section className="kvaOperationsPanel kvaRecentPirepsPanel" style={panelStyle}>
      <div style={headingStyle}>
        <div>
          <p className="eyebrow">Flight Records</p>
          <h2 style={titleStyle}>Recent PIREPs</h2>
        </div>
        <Link href="/pilot/pireps" style={linkStyle}>
          Open PIREPs →
        </Link>
      </div>

      <div className="kvaOperationsList kvaRecentPirepsList" style={listStyle}>
        {items.map((item) => (
          <article className="kvaRecentPirepRow" key={item.id} style={rowStyle}>
            <div>
              <strong>{item.code}</strong>
              <span style={subStyle}>{item.flightNumber}</span>
            </div>
            <div>
              <strong>{item.pilotName}</strong>
              <span style={subStyle}>{item.callsign}</span>
            </div>
            <div>
              <strong>
                {Math.floor(item.blockMinutes / 60)}h{" "}
                {String(item.blockMinutes % 60).padStart(2, "0")}m
              </strong>
              <span style={subStyle}>Block time</span>
            </div>
            <div>
              <strong>
                {item.landingRate === null
                  ? "—"
                  : `${item.landingRate} ft/min`}
              </strong>
              <span style={subStyle}>Landing rate</span>
            </div>
            <span style={statusStyle}>{item.status}</span>
          </article>
        ))}
      </div>
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
  gridTemplateColumns: "1fr 1.3fr 1fr 1fr auto",
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
  background: "rgba(57,220,138,.1)",
  color: "#82edb5",
  fontWeight: 800,
  textTransform: "capitalize"
} as const;

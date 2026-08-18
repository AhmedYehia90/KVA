import Link from "next/link";

type FleetItem = {
  icaoCode: string;
  manufacturer: string;
  model: string;
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
};

export function FleetSummary({items}: {items: FleetItem[]}) {
  return (
    <section className="kvaOperationsPanel kvaFleetSummaryPanel" style={panelStyle}>
      <div style={headingStyle}>
        <div>
          <p className="eyebrow">Fleet Status</p>
          <h2 style={titleStyle}>Fleet Summary</h2>
        </div>
        <Link href="/fleet" style={linkStyle}>
          Open fleet →
        </Link>
      </div>

      <div className="kvaFleetSummaryGrid" style={gridStyle}>
        {items.map((item) => (
          <article className="kvaFleetSummaryCard" key={item.icaoCode} style={cardStyle}>
            <div style={topStyle}>
              <div>
                <strong style={codeStyle}>{item.icaoCode}</strong>
                <span style={modelStyle}>
                  {item.manufacturer} {item.model}
                </span>
              </div>
              <strong style={countStyle}>{item.total}</strong>
            </div>

            <div style={statsStyle}>
              <span>Available {item.available}</span>
              <span>Assigned {item.assigned}</span>
              <span>Maintenance {item.maintenance}</span>
            </div>
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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginTop: 22
} as const;

const cardStyle = {
  padding: 18,
  border: "1px solid rgba(105,183,231,.14)",
  borderRadius: 15,
  background: "rgba(4,16,32,.18)"
} as const;

const topStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14
} as const;

const codeStyle = {display: "block", color: "var(--accent)"} as const;
const modelStyle = {
  display: "block",
  marginTop: 4,
  color: "var(--muted)",
  fontSize: ".82rem"
} as const;

const countStyle = {fontSize: "1.8rem"} as const;

const statsStyle = {
  display: "grid",
  gap: 6,
  marginTop: 16,
  color: "var(--muted)",
  fontSize: ".82rem"
} as const;

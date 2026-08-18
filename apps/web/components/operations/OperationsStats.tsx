type Stats = {
  totalAircraft: number;
  availableAircraft: number;
  assignedAircraft: number;
  maintenanceAircraft: number;
  activeFlights: number;
  pendingPireps: number;
  blockHours: number;
  averageLandingRate: number | null;
};

export function OperationsStats({stats}: {stats: Stats}) {
  const cards = [
    {label: "Total Aircraft", value: stats.totalAircraft},
    {label: "Available", value: stats.availableAircraft},
    {label: "Assigned", value: stats.assignedAircraft},
    {label: "Active Flights", value: stats.activeFlights},
    {label: "Maintenance", value: stats.maintenanceAircraft},
    {label: "Pending PIREPs", value: stats.pendingPireps},
    {label: "Block Hours", value: stats.blockHours.toFixed(1)},
    {
      label: "Average Landing",
      value:
        stats.averageLandingRate === null
          ? "—"
          : `${stats.averageLandingRate} ft/min`
    }
  ];

  return (
    <section className="kvaOperationsStatsGrid" style={gridStyle}>
      {cards.map((card) => (
        <article key={card.label} style={cardStyle}>
          <span style={labelStyle}>{card.label}</span>
          <strong style={valueStyle}>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 14
} as const;

const cardStyle = {
  padding: 22,
  border: "1px solid var(--border)",
  borderRadius: 18,
  background: "var(--surface)"
} as const;

const labelStyle = {
  display: "block",
  color: "var(--muted)",
  fontSize: ".76rem",
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase"
} as const;

const valueStyle = {
  display: "block",
  marginTop: 10,
  fontSize: "2rem"
} as const;

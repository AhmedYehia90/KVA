const stats = [
  { value: "17", label: "Aircraft" },
  { value: "6", label: "Fleet types" },
  { value: "45+", label: "Destinations" },
  { value: "24/7", label: "Operations" },
] as const;

export function Stats() {
  return (
    <section className="container stats" aria-label="Airline statistics">
      {stats.map((stat) => (
        <article className="stat" key={stat.label}>
          <strong>{stat.value}</strong>
          <span>{stat.label}</span>
        </article>
      ))}
    </section>
  );
}

const fleet = [
  {type: "E170", model: "Embraer 170", quantity: 5, role: "Regional operations"},
  {type: "A21N", model: "Airbus A321neo", quantity: 6, role: "Short and medium haul"},
  {type: "A359", model: "Airbus A350-900", quantity: 1, role: "Long-haul operations"},
  {type: "B788", model: "Boeing 787-8", quantity: 2, role: "Long-haul operations"},
  {type: "B77W", model: "Boeing 777-300ER", quantity: 2, role: "Long-haul flagship"},
  {type: "B748", model: "Boeing 747-8", quantity: 1, role: "Heavy long-haul operations"}
] as const;

export default function FleetPage() {
  return (
    <main className="section">
      <div className="container">
        <div className="eyebrow">Our fleet</div>
        <h1>Kalabsha Airlines Fleet</h1>
        <p className="muted">17 aircraft across six fleet types.</p>

        <div className="fleetGrid">
          {fleet.map((aircraft) => (
            <article className="fleetCard" key={aircraft.type}>
              <div className="fleetVisual" aria-hidden="true">✈</div>
              <div className="fleetCode">{aircraft.type}</div>
              <h2>{aircraft.model}</h2>
              <p className="muted">{aircraft.role}</p>
              <strong>{aircraft.quantity} aircraft</strong>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

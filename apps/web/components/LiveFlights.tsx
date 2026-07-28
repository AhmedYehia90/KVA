const flights = [
  { flight: "KVA201", route: "HECA → OMDB", aircraft: "A320", status: "Boarding" },
  { flight: "KVA315", route: "HECA → OKKK", aircraft: "B738", status: "En route" },
  { flight: "KVA707", route: "HECA → OEJN", aircraft: "B77W", status: "Scheduled" },
] as const;

export function LiveFlights() {
  return (
    <section className="section">
      <div className="container">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">Operations center</div>
            <h2>Live flights</h2>
          </div>
          <span className="liveBadge">
            <i />
            Network active
          </span>
        </div>

        <div className="flightTable" role="table" aria-label="Current flights">
          <div className="flightRow flightHead" role="row">
            <span>Flight</span>
            <span>Route</span>
            <span>Aircraft</span>
            <span>Status</span>
          </div>

          {flights.map((flight) => (
            <div className="flightRow" role="row" key={flight.flight}>
              <strong>{flight.flight}</strong>
              <span>{flight.route}</span>
              <span>{flight.aircraft}</span>
              <span className="status">{flight.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

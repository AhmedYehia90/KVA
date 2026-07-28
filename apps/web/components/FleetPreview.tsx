import Link from "next/link";

const fleet = [
  { code: "A320", name: "Airbus A320", role: "Regional operations" },
  { code: "B738", name: "Boeing 737-800", role: "Short and medium haul" },
  { code: "B77W", name: "Boeing 777-300ER", role: "Long-haul flagship" },
] as const;

export function FleetPreview() {
  return (
    <section className="section">
      <div className="container">
        <div className="sectionHeader">
          <div>
            <div className="eyebrow">Our fleet</div>
            <h2>Aircraft for every mission</h2>
          </div>
          <Link className="textLink" href="/fleet">
            View complete fleet →
          </Link>
        </div>

        <div className="fleetGrid">
          {fleet.map((aircraft) => (
            <article className="fleetCard" key={aircraft.code}>
              <div className="fleetVisual" aria-hidden="true">
                ✈
              </div>
              <div className="fleetCode">{aircraft.code}</div>
              <h3>{aircraft.name}</h3>
              <p className="muted">{aircraft.role}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

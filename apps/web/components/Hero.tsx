import Link from "next/link";

export function Hero() {
  return (
    <section className="hero">
      <div className="container heroGrid">
        <div className="heroContent">
          <div className="eyebrow">Kalabsha Virtual Airlines</div>
          <h1>
            Fly To
            <br />
            Dreams
          </h1>
          <p>
            A modern virtual airline built for realistic operations, active
            pilots and a growing global network.
          </p>

          <div className="actions">
            <Link className="button" href="/pilots">
              Join as a Pilot
            </Link>
            <Link className="button outline" href="/fleet">
              Explore Fleet
            </Link>
          </div>
        </div>

        <div className="heroAircraft" aria-label="Aircraft image placeholder">
          <div className="aircraftGlow" />
          <span aria-hidden="true">✈</span>
          <small>Official fleet artwork will be added here</small>
        </div>
      </div>
    </section>
  );
}

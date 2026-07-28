import Image from "next/image";
import Link from "next/link";

const statistics = [
  { value: "17", label: "Aircraft" },
  { value: "6", label: "Fleet Types" },
  { value: "45+", label: "Destinations" },
  { value: "24/7", label: "Operations" },
];

export function HeroSection() {
  return (
    <section className="home-hero">
      <div className="hero-background" aria-hidden="true" />

      <div className="container hero-layout">
        <div className="hero-content">
          <p className="hero-eyebrow">Kalabsha Airlines</p>

          <h1>
            Your journey
            <span>begins beyond.</span>
          </h1>

          <p className="hero-description">
            Experience a modern airline platform built for professional
            operations, ambitious pilots and unforgettable journeys.
          </p>

          <div className="hero-actions">
            <Link href="/pilots" className="primary-action">
              Join Kalabsha
            </Link>

            <Link href="/fleet" className="secondary-action">
              Explore Our Fleet
            </Link>
          </div>

          <div className="hero-status">
            <span className="status-indicator" />
            Virtual operations are online
          </div>
        </div>

        <div className="hero-aircraft">
          <Image
            src="/images/kalabsha-hero-aircraft.png"
            alt="Kalabsha Airlines aircraft in the approved blue and white livery"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 58vw"
          />

          <div className="flight-card flight-card-top">
            <span>Current Hub</span>
            <strong>HECA · Cairo</strong>
          </div>

          <div className="flight-card flight-card-bottom">
            <span>Flight Status</span>
            <strong className="active-flight">Operations Active</strong>
          </div>
        </div>
      </div>

      <div className="container statistics-grid">
        {statistics.map((stat) => (
          <article key={stat.label} className="statistic-card">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fleetAircraft } from "@/data/fleet";
import styles from "./page.module.css";

type PageProps = {
  params: Promise<{ aircraftId: string }>;
};

const routeSuggestions: Record<string, string[]> = {
  "embraer-170": ["Cairo — Luxor", "Cairo — Aswan", "Cairo — Sharm El Sheikh"],
  "airbus-a321neo": ["Cairo — Kuwait", "Cairo — Dubai", "Cairo — Istanbul"],
  "airbus-a350-900": ["Cairo — London", "Cairo — Paris", "Cairo — New York"],
  "boeing-787-8": ["Cairo — Bangkok", "Cairo — Tokyo", "Cairo — Toronto"],
  "boeing-777-300er": ["Cairo — Jeddah", "Cairo — Dubai", "Cairo — Kuala Lumpur"],
  "boeing-747-8": ["Cairo — New York", "Cairo — Los Angeles", "Cairo — Sydney"],
};

export function generateStaticParams() {
  return fleetAircraft.map((aircraft) => ({ aircraftId: aircraft.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { aircraftId } = await params;
  const aircraft = fleetAircraft.find((item) => item.id === aircraftId);

  if (!aircraft) return { title: "Aircraft not found" };

  return {
    title: `${aircraft.name} | Fleet`,
    description: `${aircraft.name} specifications and role in the Kalabsha Airlines virtual fleet.`,
  };
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function AircraftDetailsPage({ params }: PageProps) {
  const { aircraftId } = await params;
  const aircraft = fleetAircraft.find((item) => item.id === aircraftId);

  if (!aircraft) notFound();

  const routes = routeSuggestions[aircraft.id] ?? [];

  return (
    <main>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div>
            <Link className={styles.backLink} href="/fleet">← Back to fleet</Link>
            <p className="eyebrow">{aircraft.manufacturer} · {aircraft.code}</p>
            <h1>{aircraft.name}</h1>
            <p className={styles.lead}>{aircraft.role}</p>

            <div className={styles.badges}>
              <span>{aircraft.category}</span>
              <span>{aircraft.status}</span>
              <span>{aircraft.quantity} in fleet</span>
            </div>
          </div>

          <div className={styles.visual} aria-label="Aircraft image placeholder">
            <span aria-hidden="true">✈</span>
            <small>Official aircraft artwork will be added here</small>
          </div>
        </div>
      </section>

      <section className={styles.content}>
        <div className={`container ${styles.contentGrid}`}>
          <div>
            <p className="eyebrow">Technical overview</p>
            <h2>Aircraft specifications</h2>

            <dl className={styles.specGrid}>
              <div><dt>Maximum range</dt><dd>{number(aircraft.rangeKm)} km</dd></div>
              <div><dt>Cruise speed</dt><dd>{aircraft.cruiseKts} kt</dd></div>
              <div><dt>Passenger capacity</dt><dd>{aircraft.capacity}</dd></div>
              <div><dt>Fleet quantity</dt><dd>{aircraft.quantity}</dd></div>
              <div><dt>ICAO code</dt><dd>{aircraft.code}</dd></div>
              <div><dt>Category</dt><dd>{aircraft.category}</dd></div>
            </dl>
          </div>

          <aside className={styles.routes}>
            <p className="eyebrow">Suggested operations</p>
            <h2>Example routes</h2>
            <ul>
              {routes.map((route) => (
                <li key={route}><span aria-hidden="true">✈</span>{route}</li>
              ))}
            </ul>
            <p>
              These routes are initial planning examples and can later be
              connected to the schedules database.
            </p>
          </aside>
        </div>
      </section>

      <section className={styles.callout}>
        <div className={`container ${styles.calloutInner}`}>
          <div>
            <p className="eyebrow">Pilot program</p>
            <h2>Train, qualify and fly this aircraft</h2>
            <p>
              Aircraft access will later be connected to pilot rank, completed
              hours and qualification records.
            </p>
          </div>
          <Link className="button" href="/pilots">View pilot program</Link>
        </div>
      </section>
    </main>
  );
}

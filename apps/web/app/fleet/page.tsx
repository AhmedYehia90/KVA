import type { Metadata } from "next";
import { FleetExplorer } from "@/components/FleetExplorer";
import { fleetAircraft } from "@/data/fleet";

export const metadata: Metadata = {
  title: "Fleet",
  description:
    "Explore the Kalabsha Airlines virtual fleet, including regional, narrow-body and wide-body aircraft.",
};

const totalAircraft = fleetAircraft.reduce(
  (total, aircraft) => total + aircraft.quantity,
  0,
);

const activeTypes = fleetAircraft.filter(
  (aircraft) => aircraft.status === "Active",
).length;

export default function FleetPage() {
  return (
    <main>
      <section className="subpageHero fleetPageHero">
        <div className="container subpageHeroInner">
          <div>
            <div className="eyebrow">Kalabsha Airlines Fleet</div>
            <h1>Built for every journey</h1>
            <p>
              From domestic sectors to long-haul operations, our virtual fleet
              is structured to support realistic schedules, events and pilot
              progression.
            </p>
          </div>

          <div className="fleetHeroGraphic" aria-hidden="true">
            <span>✈</span>
          </div>
        </div>
      </section>

      <section className="fleetSummary">
        <div className="container fleetSummaryGrid">
          <article>
            <strong>{totalAircraft}</strong>
            <span>Total aircraft</span>
          </article>
          <article>
            <strong>{fleetAircraft.length}</strong>
            <span>Aircraft types</span>
          </article>
          <article>
            <strong>{activeTypes}</strong>
            <span>Active types</span>
          </article>
          <article>
            <strong>3</strong>
            <span>Fleet categories</span>
          </article>
        </div>
      </section>

      <section className="section fleetCatalog">
        <div className="container">
          <div className="sectionHeader fleetCatalogHeader">
            <div>
              <div className="eyebrow">Aircraft catalogue</div>
              <h2>Explore the fleet</h2>
            </div>
            <p className="muted fleetCatalogIntro">
              Performance figures are planning values for the virtual airline
              and can be adjusted later to match the final operational system.
            </p>
          </div>

          <FleetExplorer aircraft={fleetAircraft} />
        </div>
      </section>

      <section className="fleetCallout">
        <div className="container fleetCalloutInner">
          <div>
            <div className="eyebrow">Pilot progression</div>
            <h2>Unlock more aircraft as you fly</h2>
            <p>
              The future pilot system can assign aircraft qualifications based
              on rank, completed flights, hours and training.
            </p>
          </div>

          <a className="button" href="/pilots">
            View pilot program
          </a>
        </div>
      </section>
    </main>
  );
}

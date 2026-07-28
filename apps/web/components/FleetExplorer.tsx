"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FleetAircraft, FleetCategory } from "@/data/fleet";

type FilterValue = "All" | FleetCategory;

const filters: FilterValue[] = [
  "All",
  "Regional",
  "Narrow-body",
  "Wide-body",
  "Jumbo",
];

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function FleetExplorer({ aircraft }: { aircraft: FleetAircraft[] }) {
  const [filter, setFilter] = useState<FilterValue>("All");

  const visibleAircraft = useMemo(
    () =>
      filter === "All"
        ? aircraft
        : aircraft.filter((item) => item.category === filter),
    [aircraft, filter],
  );

  return (
    <>
      <div className="fleetToolbar" aria-label="Fleet category filters">
        <div>
          <span className="fleetToolbarLabel">Filter fleet</span>
          <div className="fleetFilters">
            {filters.map((item) => (
              <button
                className={filter === item ? "fleetFilter active" : "fleetFilter"}
                key={item}
                onClick={() => setFilter(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <p className="fleetResultCount">
          Showing <strong>{visibleAircraft.length}</strong> aircraft types
        </p>
      </div>

      <div className="fleetExplorerGrid">
        {visibleAircraft.map((item) => (
          <article className="aircraftCard" key={item.id}>
            <div className="aircraftVisual">
              <div className="aircraftVisualTopline">
                <span>{item.manufacturer}</span>
                <span className={`aircraftStatus ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
              <div className="aircraftSilhouette" aria-hidden="true">✈</div>
              <span className="aircraftCode">{item.code}</span>
            </div>

            <div className="aircraftBody">
              <p className="aircraftCategory">{item.category}</p>
              <h2>{item.name}</h2>
              <p className="muted">{item.role}</p>

              <dl className="aircraftSpecs">
                <div><dt>Range</dt><dd>{number(item.rangeKm)} km</dd></div>
                <div><dt>Cruise</dt><dd>{item.cruiseKts} kt</dd></div>
                <div><dt>Capacity</dt><dd>{item.capacity}</dd></div>
                <div><dt>In fleet</dt><dd>{item.quantity}</dd></div>
              </dl>

              <Link className="aircraftDetailsButton" href={`/fleet/${item.id}`}>
                Aircraft details
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

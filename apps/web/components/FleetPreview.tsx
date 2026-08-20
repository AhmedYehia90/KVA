"use client";

import Image from "next/image";
import {useEffect, useRef} from "react";
import Link from "next/link";
import {officialFleetTypes} from "@/lib/fleet-artwork";
import styles from "./FleetPreview.module.css";

export function FleetPreview() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    track.scrollTo({
      left: 0,
      behavior: "auto"
    });
  }, []);
  return (
    <section className={`section ${styles.section}`} aria-labelledby="official-fleet-title">
      <div className="container">
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Kalabsha Airlines</span>
            <h2 id="official-fleet-title">Official Fleet</h2>
            <p>
              Explore the aircraft that power the Kalabsha Airlines network.
            </p>
          </div>

          <Link className={styles.viewAll} href="/fleet">
            Explore Fleet →
          </Link>
        </div>

        <div ref={trackRef} className={styles.track} aria-label="Official Kalabsha Airlines fleet">
          {officialFleetTypes.map((aircraft) => (
            <Link className={styles.card} href="/fleet" key={aircraft.code}>
              <span className={styles.badge}>Official Kalabsha Fleet</span>

              <div className={styles.imageFrame}>
                <Image
                  src={aircraft.src}
                  alt={aircraft.alt}
                  width={2048}
                  height={1156}
                  sizes="(max-width: 680px) 84vw, (max-width: 1100px) 44vw, 330px"
                  className={styles.image}
                />
              </div>

              <div className={styles.cardMeta}>
                <div>
                  <span className={styles.code}>{aircraft.code}</span>
                  <h3>{aircraft.name}</h3>
                </div>
                <span className={styles.category}>{aircraft.category}</span>
              </div>
            </Link>
          ))}
        </div>

        <p className={styles.hint}>Swipe or scroll horizontally to explore the full fleet.</p>
      </div>
    </section>
  );
}

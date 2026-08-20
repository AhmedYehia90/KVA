import Image from "next/image";
import Link from "next/link";
import {getOfficialFleetArtwork} from "@/lib/fleet-artwork";
import styles from "./OfficialFleetImage.module.css";

type OfficialFleetImageProps = {
  icaoCode: string | null | undefined;
  name?: string | null;
  flightNumber?: string | null;
};

export function OfficialFleetImage({
  icaoCode,
  name,
  flightNumber
}: OfficialFleetImageProps) {
  const artwork = getOfficialFleetArtwork(icaoCode);

  if (!artwork) {
    return null;
  }

  return (
    <section className={styles.panel} aria-label={`${artwork.name} official fleet artwork`}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Official Kalabsha Fleet</span>
          <div className={styles.titleRow}>
            <strong>{artwork.code}</strong>
            <span>{name || artwork.name}</span>
          </div>
        </div>

        <Link className={styles.link} href="/fleet">
          Explore fleet →
        </Link>
      </div>

      <div className={styles.imageFrame}>
        <Image
          src={artwork.src}
          alt={artwork.alt}
          width={2048}
          height={1156}
          sizes="(max-width: 760px) 100vw, (max-width: 1180px) 70vw, 820px"
          className={styles.image}
          priority={false}
        />
        {flightNumber ? (
          <span className={styles.flightBadge}>{flightNumber}</span>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import {useEffect, useState} from "react";
import styles from "./MarketplaceThumbnail.module.css";

type MarketplaceThumbnailProps = {
  src: string;
  alt: string;
  badge?: string;
};

const PLACEHOLDER = "/marketplace/placeholder.svg";

export function MarketplaceThumbnail({
  src,
  alt,
  badge,
}: MarketplaceThumbnailProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    setResolvedSrc(src);
  }, [src]);

  return (
    <div className={styles.frame}>
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw"
        unoptimized={resolvedSrc.endsWith(".svg")}
        className={styles.image}
        onError={() => {
          if (resolvedSrc !== PLACEHOLDER) {
            setResolvedSrc(PLACEHOLDER);
          }
        }}
      />
      <span aria-hidden="true" className={styles.gloss} />
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </div>
  );
}

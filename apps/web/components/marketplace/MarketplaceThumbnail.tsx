"use client";
import {localizeUi} from "@/i18n/localize-ui";
import {useLocale as useUiLocale} from "next-intl";

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
  const uiLocale = useUiLocale();

  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    setResolvedSrc(src);
  }, [src]);

  return localizeUi((
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
  ), uiLocale);
}

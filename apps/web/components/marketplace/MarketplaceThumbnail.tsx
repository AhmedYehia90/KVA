"use client";

import Image from "next/image";
import {useEffect, useState} from "react";

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
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(91, 183, 235, .20)",
        background:
          "linear-gradient(180deg, rgba(8,35,67,.72), rgba(6,27,54,.86))",
        aspectRatio: "16 / 9",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.025), 0 8px 20px rgba(0,0,0,.10)",
      }}
    >
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw"
        unoptimized={resolvedSrc.endsWith(".svg")}
        style={{objectFit: "cover"}}
        onError={() => {
          if (resolvedSrc !== PLACEHOLDER) {
            setResolvedSrc(PLACEHOLDER);
          }
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(255,255,255,.025), transparent 30%, rgba(2,14,30,.10))",
        }}
      />
      {badge ? (
        <span
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            borderRadius: 999,
            padding: "5px 9px",
            background: "rgba(4,24,49,.86)",
            border: "1px solid rgba(105,207,255,.34)",
            color: "#dff7ff",
            boxShadow: "0 5px 14px rgba(0,0,0,.12)",
            backdropFilter: "blur(8px)",
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: ".065em",
            textTransform: "uppercase",
          }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}

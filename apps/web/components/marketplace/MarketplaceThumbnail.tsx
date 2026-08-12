"use client";

type MarketplaceThumbnailProps = {
  src: string;
  alt: string;
  badge?: string;
};

export function MarketplaceThumbnail({ src, alt, badge }: MarketplaceThumbnailProps) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid rgba(93, 190, 244, 0.2)",
        background: "#071a34",
        aspectRatio: "16 / 9",
        marginBottom: 14,
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        onError={(event) => {
          if (!event.currentTarget.src.endsWith("/marketplace/placeholder.svg")) {
            event.currentTarget.src = "/marketplace/placeholder.svg";
          }
        }}
      />
      {badge ? (
        <span
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            borderRadius: 999,
            padding: "6px 10px",
            background: "rgba(4, 20, 42, 0.88)",
            border: "1px solid rgba(126, 216, 255, 0.35)",
            color: "#dff7ff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".06em",
            textTransform: "uppercase",
          }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}

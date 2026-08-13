"use client";

type MarketplaceThumbnailProps = {
  src: string;
  alt: string;
  badge?: string;
};

export function MarketplaceThumbnail({src, alt, badge}: MarketplaceThumbnailProps) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(91, 183, 235, .20)",
        background: "linear-gradient(180deg, rgba(8,35,67,.72), rgba(6,27,54,.86))",
        aspectRatio: "16 / 9",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.025), 0 8px 20px rgba(0,0,0,.10)",
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
        onError={(event) => {
          if (!event.currentTarget.src.endsWith("/marketplace/placeholder.svg")) {
            event.currentTarget.src = "/marketplace/placeholder.svg";
          }
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position:"absolute",
          inset:0,
          pointerEvents:"none",
          background:"linear-gradient(180deg, rgba(255,255,255,.025), transparent 30%, rgba(2,14,30,.10))",
        }}
      />
      {badge ? (
        <span
          style={{
            position:"absolute",
            left:10,
            top:10,
            borderRadius:999,
            padding:"5px 9px",
            background:"rgba(4,24,49,.86)",
            border:"1px solid rgba(105,207,255,.34)",
            color:"#dff7ff",
            boxShadow:"0 5px 14px rgba(0,0,0,.12)",
            backdropFilter:"blur(8px)",
            fontSize:10,
            fontWeight:850,
            letterSpacing:".065em",
            textTransform:"uppercase",
          }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}

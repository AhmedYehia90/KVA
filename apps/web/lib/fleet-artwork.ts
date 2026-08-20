export type OfficialFleetArtwork = {
  code: string;
  name: string;
  src: string;
  alt: string;
  category: "Regional" | "Narrowbody" | "Widebody";
};

export const officialFleetTypes: OfficialFleetArtwork[] = [
  {
    code: "A21N",
    name: "Airbus A321neo",
    src: "/fleet/official/a321neo.webp",
    alt: "Kalabsha Airlines Airbus A321neo at Aswan International Airport",
    category: "Narrowbody"
  },
  {
    code: "A333",
    name: "Airbus A330-300",
    src: "/fleet/official/a330-300.webp",
    alt: "Kalabsha Airlines Airbus A330-300 at Aswan International Airport",
    category: "Widebody"
  },
  {
    code: "A359",
    name: "Airbus A350-900",
    src: "/fleet/official/a350-900.webp",
    alt: "Kalabsha Airlines Airbus A350-900 at Aswan International Airport",
    category: "Widebody"
  },
  {
    code: "B748",
    name: "Boeing 747-8",
    src: "/fleet/official/b747-8.webp",
    alt: "Kalabsha Airlines Boeing 747-8 at Aswan International Airport",
    category: "Widebody"
  },
  {
    code: "B77W",
    name: "Boeing 777-300ER",
    src: "/fleet/official/b777-300er.webp",
    alt: "Kalabsha Airlines Boeing 777-300ER at Aswan International Airport",
    category: "Widebody"
  },
  {
    code: "B788",
    name: "Boeing 787-8 Dreamliner",
    src: "/fleet/official/b787-8.webp",
    alt: "Kalabsha Airlines Boeing 787-8 Dreamliner at Aswan International Airport",
    category: "Widebody"
  },
  {
    code: "E170",
    name: "Embraer E170",
    src: "/fleet/official/e170.webp",
    alt: "Kalabsha Airlines Embraer E170 at Aswan International Airport",
    category: "Regional"
  }
];

const aliasToCanonical: Record<string, string> = {
  A321: "A21N",
  A320: "A21N",
  A330: "A333",
  A350: "A359",
  B747: "B748",
  B773: "B77W",
  B777: "B77W",
  B787: "B788",
  B789: "B788"
};

const officialFleetByCode = new Map(
  officialFleetTypes.map((aircraft) => [aircraft.code, aircraft])
);

export function getOfficialFleetArtwork(
  icaoCode: string | null | undefined
): OfficialFleetArtwork | null {
  if (!icaoCode) return null;

  const normalized = icaoCode.trim().toUpperCase();
  const canonical = aliasToCanonical[normalized] ?? normalized;

  return officialFleetByCode.get(canonical) ?? null;
}

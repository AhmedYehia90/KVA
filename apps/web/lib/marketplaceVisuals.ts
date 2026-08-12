export const AIRCRAFT_MARKETPLACE_THUMBNAILS: Record<string, string> = {
  E170: "/marketplace/aircraft/e170.svg",
  A21N: "/marketplace/aircraft/a21n.svg",
  B788: "/marketplace/aircraft/b788.svg",
  A333: "/marketplace/aircraft/a333.svg",
  B77W: "/marketplace/aircraft/b77w.svg",
  A359: "/marketplace/aircraft/a359.svg",
  B748: "/marketplace/aircraft/b748.svg",
};

const PILOT_ITEM_VISUALS: Array<[RegExp, string]> = [
  [/skyline.*passport.*frame/i, "/marketplace/pilot/skyline-passport-frame.svg"],
  [/night.*operations.*profile.*theme/i, "/marketplace/pilot/night-operations-profile-theme.svg"],
  [/founder.*flight.*collectible/i, "/marketplace/pilot/kva-os-founder-flight-collectible.svg"],
  [/ten.*flight.*foundation/i, "/marketplace/pilot/ten-flight-foundation-badge.svg"],
  [/first.*officer.*certificate/i, "/marketplace/pilot/first-officer-certificate.svg"],
  [/kalabsha.*blue.*heritage.*livery/i, "/marketplace/pilot/kalabsha-blue-heritage-livery.svg"],
];

export function getAircraftMarketplaceThumbnail(icaoCode?: string | null) {
  if (!icaoCode) return "/marketplace/placeholder.svg";
  return AIRCRAFT_MARKETPLACE_THUMBNAILS[icaoCode.trim().toUpperCase()] ?? "/marketplace/placeholder.svg";
}

export function getPilotMarketplaceThumbnail(input?: string | null) {
  const value = input?.trim() ?? "";
  const match = PILOT_ITEM_VISUALS.find(([pattern]) => pattern.test(value));
  return match?.[1] ?? "/marketplace/placeholder.svg";
}

export function getMarketplaceThumbnailAlt(input?: string | null) {
  return input?.trim() ? `${input.trim()} marketplace thumbnail` : "KVA OS marketplace item";
}

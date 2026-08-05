export type AircraftOperationalStatus =
  | "available" | "reserved" | "boarding" | "taxi" | "enroute" | "landed";

export function aircraftStatusForEvent(
  eventType: string,
): AircraftOperationalStatus | undefined {
  return {
    "flight.booked": "reserved",
    "aircraft.assigned": "reserved",
    "dispatch.created": "reserved",
    "flight.boarding_started": "boarding",
    "flight.pushback_started": "taxi",
    "flight.takeoff_recorded": "enroute",
    "flight.landing_recorded": "landed",
    "flight.completed": "available",
  }[eventType] as AircraftOperationalStatus | undefined;
}

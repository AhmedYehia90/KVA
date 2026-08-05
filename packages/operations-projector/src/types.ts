export type OperationsFlightStatus =
  | "booked"
  | "boarding"
  | "departed"
  | "enroute"
  | "landed"
  | "completed"
  | "cancelled"
  | "expired";

export interface OperationsFlightProjection {
  bookingId: string;
  organizationId?: string;
  routeId?: string;
  flightNumber?: string;
  pilotId?: string;
  aircraftId?: string | null;
  dispatchId?: string;
  pirepId?: string;
  status: OperationsFlightStatus;
  startedAt?: string;
  completedAt?: string;
  lastEventId: string;
  lastEventType: string;
  lastEventAt: string;
  version: number;
}

export interface FlightEventPayload {
  bookingId: string;
  routeId?: string;
  flightNumber?: string;
  pilotId?: string;
  aircraftId?: string | null;
  dispatchId?: string;
  pirepId?: string;
  status?: OperationsFlightStatus;
}

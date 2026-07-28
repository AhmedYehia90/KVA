export type PirepStatus = "Approved" | "Pending" | "Rejected";

export type PilotFlight = {
  id: string;
  flightNumber: string;
  route: string;
  aircraft: string;
  date: string;
  durationMinutes: number;
  status: PirepStatus;
};

export type PilotProfile = {
  callsign: string;
  name: string;
  rank: string;
  totalHours: number;
  completedFlights: number;
  currentRankMinimumHours: number;
  nextRank: string;
  nextRankHours: number;
  homeBase: string;
  joinedAt: string;
  qualifications: string[];
  recentFlights: PilotFlight[];
};

export const currentPilot: PilotProfile = {
  callsign: "KVA001",
  name: "Ahmed Yehia",
  rank: "Senior First Officer",
  totalHours: 186,
  completedFlights: 74,
  currentRankMinimumHours: 150,
  nextRank: "Captain",
  nextRankHours: 250,
  homeBase: "Cairo International — HECA",
  joinedAt: "2026-01-12",
  qualifications: [
    "Embraer 170",
    "Airbus A321neo",
    "Boeing 787-8",
  ],
  recentFlights: [
    {
      id: "pirep-1042",
      flightNumber: "KVA214",
      route: "HECA → OKKK",
      aircraft: "Airbus A321neo",
      date: "2026-07-26",
      durationMinutes: 156,
      status: "Approved",
    },
    {
      id: "pirep-1038",
      flightNumber: "KVA118",
      route: "HECA → OERK",
      aircraft: "Airbus A321neo",
      date: "2026-07-23",
      durationMinutes: 128,
      status: "Approved",
    },
    {
      id: "pirep-1031",
      flightNumber: "KVA602",
      route: "HECA → EGLL",
      aircraft: "Boeing 787-8",
      date: "2026-07-19",
      durationMinutes: 292,
      status: "Pending",
    },
    {
      id: "pirep-1024",
      flightNumber: "KVA082",
      route: "HECA → HEMA",
      aircraft: "Embraer 170",
      date: "2026-07-15",
      durationMinutes: 72,
      status: "Approved",
    },
  ],
};

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

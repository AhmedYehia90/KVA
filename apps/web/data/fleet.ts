export type FleetCategory =
  | "Regional"
  | "Narrow-body"
  | "Wide-body"
  | "Jumbo";

export type FleetAircraft = {
  id: string;
  code: string;
  manufacturer: string;
  name: string;
  category: FleetCategory;
  role: string;
  rangeKm: number;
  cruiseKts: number;
  capacity: number;
  quantity: number;
  status: "Active" | "Planned";
};

export const fleetAircraft: FleetAircraft[] = [
  {
    id: "embraer-170",
    code: "E170",
    manufacturer: "Embraer",
    name: "Embraer 170",
    category: "Regional",
    role: "Domestic and short regional operations",
    rangeKm: 3700,
    cruiseKts: 447,
    capacity: 78,
    quantity: 5,
    status: "Active",
  },
  {
    id: "airbus-a321neo",
    code: "A21N",
    manufacturer: "Airbus",
    name: "A321neo",
    category: "Narrow-body",
    role: "Regional and medium-haul operations",
    rangeKm: 7400,
    cruiseKts: 450,
    capacity: 220,
    quantity: 6,
    status: "Active",
  },
  {
    id: "airbus-a350-900",
    code: "A359",
    manufacturer: "Airbus",
    name: "A350-900",
    category: "Wide-body",
    role: "Long-haul passenger operations",
    rangeKm: 15000,
    cruiseKts: 488,
    capacity: 350,
    quantity: 1,
    status: "Active",
  },
  {
    id: "boeing-787-8",
    code: "B788",
    manufacturer: "Boeing",
    name: "787-8 Dreamliner",
    category: "Wide-body",
    role: "Long-haul and intercontinental operations",
    rangeKm: 13530,
    cruiseKts: 488,
    capacity: 248,
    quantity: 2,
    status: "Active",
  },
  {
    id: "boeing-777-300er",
    code: "B77W",
    manufacturer: "Boeing",
    name: "777-300ER",
    category: "Wide-body",
    role: "High-capacity long-haul operations",
    rangeKm: 13650,
    cruiseKts: 490,
    capacity: 396,
    quantity: 2,
    status: "Active",
  },
  {
    id: "boeing-747-8",
    code: "B748",
    manufacturer: "Boeing",
    name: "747-8 Intercontinental",
    category: "Jumbo",
    role: "Flagship high-capacity operations",
    rangeKm: 14320,
    cruiseKts: 493,
    capacity: 467,
    quantity: 1,
    status: "Active",
  },
];

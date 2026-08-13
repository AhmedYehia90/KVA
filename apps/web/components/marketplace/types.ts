export type PilotUnlockRequirements = {
  minimumCareerXp?: number | null;
  minimumFlights?: number | null;
  requiredRankCode?: string | null;
  requiredMilestoneCode?: string | null;
  requiredMilestoneTitle?: string | null;
};

export type PilotMarketplaceVisualItem = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  unlock?: {
    state?: string | null;
    requirements?: PilotUnlockRequirements | null;
  } | null;
};

export type CompanyMarketplaceItem = {
  id: string;
  name: string;
  description?: string | null;
  item_kind: string;
  price: number;
  fleet_type?: {
    icao_code?: string | null;
  } | null;
};

export type CompanyEconomyAsset = {
  id?: string;
  asset_kind?: string;
  status: string;
  fleet_type_id?: string | null;
  acquired_at?: string | null;
  metadata?: {
    marketplaceItemId?: string | null;
  } | null;
};

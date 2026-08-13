import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {contributeRouteSupportAction} from "./actions";
import {PilotStore} from "@/components/marketplace/PilotStore";
import type {PilotMarketplaceVisualItem} from "@/components/marketplace/types";

export const metadata: Metadata = {title: "Career & Economy | KVA OS"};
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type NextRank = {
  code: string;
  minimumHours: number;
  minimumFlights: number;
};

type CareerSummary = {
  currentRankCode: string;
  careerXp: number;
  completedFlights: number;
  flightMinutes: number;
  lifetimeSalary: number;
  lifetimeBonus: number;
  nextRank?: NextRank | null;
};

type WalletSummary = {
  balance: number;
  totalEarned: number;
  totalSpent: number;
};

type RouteSupportCampaign = {
  id: string;
  departure: string;
  arrival: string;
  title: string;
  fundedAmount: number;
  targetAmount: number;
  myContribution: number;
  status: string;
};

type RecentTransaction = {
  id: string;
  transactionType: string;
  description: string;
  amount: number;
};

type PilotEconomyDashboard = {
  career: CareerSummary;
  wallet: WalletSummary;
  routeCampaigns?: RouteSupportCampaign[];
  recentTransactions?: RecentTransaction[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function money(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} KVC`;
}

export default async function CareerEconomyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) redirect("/pilots/login");

  const [
    {data, error},
    {data: visualMarketplace, error: visualMarketplaceError},
  ] = await Promise.all([
    supabase.rpc("get_pilot_career_economy_dashboard"),
    supabase.rpc("get_pilot_visual_marketplace"),
  ]);

  if (error) {
    throw new Error(`Unable to load Career & Economy: ${error.message}`);
  }
  if (visualMarketplaceError) {
    throw new Error(
      `Unable to load Pilot Marketplace: ${visualMarketplaceError.message}`,
    );
  }

  const dashboard = data as unknown as PilotEconomyDashboard;
  const career = dashboard.career;
  const wallet = dashboard.wallet;
  const marketplace = (visualMarketplace ?? []) as unknown as PilotMarketplaceVisualItem[];

  return (
    <main style={{minHeight: "100vh", background: "var(--bg)"}}>
      <section
        style={{
          padding: "74px 20px 115px",
          background:
            "radial-gradient(circle at 80% 20%,rgba(0,174,239,.25),transparent 30%),linear-gradient(145deg,#06152d,#0b2344 58%,#124d79)",
        }}
      >
        <div style={{maxWidth: 1180, margin: "0 auto"}}>
          <Link
            href="/pilot/dashboard"
            style={{color: "var(--accent)", fontWeight: 850}}
          >
            ← Pilot Dashboard
          </Link>
          <p className="eyebrow" style={{marginTop: 32}}>
            KVA OS · Pillar 08
          </p>
          <h1
            style={{
              margin: "10px 0 16px",
              fontSize: "clamp(3.4rem,8vw,6rem)",
              lineHeight: 0.94,
            }}
          >
            Career & Economy
          </h1>
          <p style={{maxWidth: 820, color: "var(--muted)", lineHeight: 1.8}}>
            Build your career from recorded flights, earn through evidence,
            spend through your Pilot Marketplace and support route-interest
            campaigns without receiving company fleet authority.
          </p>
        </div>
      </section>

      <section style={{padding: "0 20px 100px"}}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "grid",
            gap: 22,
            transform: "translateY(-44px)",
          }}
        >
          {first(params.message) ? (
            <div style={noticeOk}>{first(params.message)}</div>
          ) : null}
          {first(params.error) ? (
            <div style={noticeBad}>{first(params.error)}</div>
          ) : null}

          <div style={stats}>
            <Stat label="Career Rank" value={career.currentRankCode} />
            <Stat label="Career XP" value={String(career.careerXp)} />
            <Stat label="KVA Credits Balance" value={money(wallet.balance)} />
            <Stat label="Total Earned" value={money(wallet.totalEarned)} />
            <Stat label="Total Spent" value={money(wallet.totalSpent)} />
          </div>

          <section style={panel}>
            <p className="eyebrow">Career Progress</p>
            <h2>
              {career.currentRankCode}
              {career.nextRank ? ` → ${career.nextRank.code}` : " · Top rank"}
            </h2>
            <p style={{color: "var(--muted)"}}>
              {career.completedFlights} flights ·{" "}
              {Math.round((career.flightMinutes / 60) * 10) / 10} hours ·
              Lifetime salary {money(career.lifetimeSalary)} · Bonuses{" "}
              {money(career.lifetimeBonus)}
            </p>
            {career.nextRank ? (
              <p>
                Next rank requires {career.nextRank.minimumHours} hours and{" "}
                {career.nextRank.minimumFlights} flights.
              </p>
            ) : null}
          </section>

          <PilotStore
            items={marketplace}
            balance={Number(wallet.balance)}
            money={money}
          />

          <section style={panel}>
            <p className="eyebrow">Route Support</p>
            <h2>Prove interest, not authority</h2>
            <p style={{color: "var(--muted)"}}>
              Funding progress is a community-interest signal. Even at 100%,
              Operations decides whether the route is approved or opened.
            </p>
            <div style={{display: "grid", gap: 12}}>
              {(dashboard.routeCampaigns ?? []).map((campaign) => {
                const pct = Math.min(
                  100,
                  Math.round(
                    (campaign.fundedAmount / campaign.targetAmount) * 100,
                  ),
                );
                return (
                  <article key={campaign.id} style={inner}>
                    <strong>
                      {campaign.departure} → {campaign.arrival} · {campaign.title}
                    </strong>
                    <p>
                      {pct}% · {money(campaign.fundedAmount)} /{" "}
                      {money(campaign.targetAmount)} · Your support{" "}
                      {money(campaign.myContribution)}
                    </p>
                    <div
                      style={{
                        height: 9,
                        borderRadius: 999,
                        background: "rgba(255,255,255,.08)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                    {["active", "goal_reached"].includes(campaign.status) ? (
                      <form
                        action={contributeRouteSupportAction}
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          type="hidden"
                          name="campaignId"
                          value={campaign.id}
                        />
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="250"
                          style={input}
                        />
                        <button className="button" type="submit">
                          Support route
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section style={panel}>
            <p className="eyebrow">Economy Ledger</p>
            <h2>Recent Transactions</h2>
            <div style={{display: "grid", gap: 8}}>
              {(dashboard.recentTransactions ?? []).map((transaction) => (
                <article
                  key={transaction.id}
                  style={{
                    ...inner,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div>
                    <strong>{transaction.transactionType}</strong>
                    <small
                      style={{
                        display: "block",
                        color: "var(--muted)",
                        marginTop: 4,
                      }}
                    >
                      {transaction.description}
                    </small>
                  </div>
                  <strong
                    style={{
                      color: transaction.amount > 0 ? "#98efbf" : "#ffb1b1",
                    }}
                  >
                    {transaction.amount > 0 ? "+" : ""}
                    {money(transaction.amount)}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <article style={stat}>
      <small>{label.toUpperCase()}</small>
      <strong style={{display: "block", fontSize: "1.8rem", marginTop: 12}}>
        {value}
      </strong>
    </article>
  );
}

const panel = {
  padding: 22,
  border: "1px solid var(--border)",
  borderRadius: 20,
  background: "var(--surface)",
} as const;
const inner = {
  padding: 16,
  border: "1px solid rgba(105,183,231,.14)",
  borderRadius: 14,
  background: "rgba(4,16,32,.28)",
} as const;
const stats = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
} as const;
const stat = {...panel, minHeight: 110} as const;
const input = {
  padding: "12px 13px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "rgba(4,16,32,.42)",
  color: "inherit",
} as const;
const noticeOk = {
  padding: 14,
  borderRadius: 12,
  color: "#98efbf",
  background: "rgba(57,220,138,.1)",
} as const;
const noticeBad = {
  padding: 14,
  borderRadius: 12,
  color: "#ffb1b1",
  background: "rgba(255,95,95,.1)",
} as const;

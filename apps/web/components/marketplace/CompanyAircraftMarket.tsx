import {purchaseCompanyItemAction} from "@/app/operations/economy/actions";
import {MarketplaceThumbnail} from "@/components/marketplace/MarketplaceThumbnail";
import type {
  CompanyEconomyAsset,
  CompanyMarketplaceItem,
} from "@/components/marketplace/types";
import {
  getAircraftMarketplaceThumbnail,
  getMarketplaceThumbnailAlt,
} from "@/lib/marketplaceVisuals";
import styles from "./MarketplacePremium.module.css";

type CompanyAircraftMarketProps = {
  items: CompanyMarketplaceItem[];
  assets: CompanyEconomyAsset[];
  balance: number;
  money: (value: number) => string;
};

function titleCase(value: string | null | undefined) {
  return String(value ?? "company asset")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CompanyAircraftMarket({
  items,
  assets,
  balance,
  money,
}: CompanyAircraftMarketProps) {
  return (
    <section className={styles.shell} id="company-marketplace">
      <div className={styles.content}>
        <div className={styles.headingRow}>
          <div className={styles.headingGroup}>
            <div className={styles.icon} aria-hidden="true">✈</div>
            <div>
              <p className={styles.eyebrow}>KVA OS Marketplace</p>
              <div className={styles.titleLine}>
                <h2 className={styles.title}>Aircraft Market</h2>
                <span className={styles.accessBadge}>Company access only</span>
              </div>
              <p className={styles.subtitle}>
                Acquire economic aircraft assets through Operations. Purchase
                and lease decisions remain company-only and never mutate the
                fleet automatically.
              </p>
            </div>
          </div>

          <div className={styles.balance}>
            <small>Company KVA Credits</small>
            <strong>{money(balance)}</strong>
          </div>
        </div>

        <div className={styles.chips} aria-label="Aircraft Market categories">
          <span className={styles.chipActive}>Aircraft</span>
          <span className={styles.chip}>Purchase</span>
          <span className={styles.chip}>Lease</span>
          <span className={styles.chip}>Operational Assets</span>
          <span className={styles.chip}>Expansion</span>
        </div>

        <div className={styles.grid}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              No company marketplace assets are currently available.
            </div>
          ) : null}

          {items.map((item) => {
            const fleetCode = item.fleet_type?.icao_code ?? null;
            const matchingAsset = assets.find(
              (asset) =>
                asset.status === "acquired" &&
                String(asset.metadata?.marketplaceItemId ?? "") === String(item.id),
            );
            const oneTimeAcquired =
              item.item_kind === "aircraft_purchase" && Boolean(matchingAsset);
            const canAfford = Number(balance) >= Number(item.price);
            const state = oneTimeAcquired
              ? "ACQUIRED"
              : canAfford
                ? "AVAILABLE FOR OPERATIONS"
                : "INSUFFICIENT COMPANY BUDGET";

            const stateClass = oneTimeAcquired
              ? `${styles.state} ${styles.stateGood}`
              : canAfford
                ? styles.state
                : `${styles.state} ${styles.stateWarn}`;

            return (
              <article className={styles.card} key={item.id}>
                <div className={styles.visual}>
                  <MarketplaceThumbnail
                    src={
                      fleetCode
                        ? getAircraftMarketplaceThumbnail(fleetCode)
                        : "/marketplace/placeholder.svg"
                    }
                    alt={getMarketplaceThumbnailAlt(item.name)}
                    badge="Company Only"
                  />
                </div>

                <div className={styles.body}>
                  <div className={stateClass}>{state}</div>
                  <h3 className={styles.itemTitle}>{item.name}</h3>
                  <p className={styles.description}>{item.description}</p>

                  <div className={styles.meta}>
                    <span>{titleCase(item.item_kind)}</span>
                    <span>{fleetCode ?? "No fleet type"}</span>
                  </div>

                  <div className={styles.priceRow}>
                    <span className={styles.price}>
                      <span className={styles.currencyDot}>K</span>
                      {money(Number(item.price))}
                    </span>
                  </div>

                  <div className={styles.action}>
                    {oneTimeAcquired ? (
                      <button className={styles.buttonOwned} type="button" disabled>
                        Acquired
                      </button>
                    ) : (
                      <form action={purchaseCompanyItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          className={canAfford ? styles.button : styles.buttonDisabled}
                          type="submit"
                          disabled={!canAfford}
                        >
                          {canAfford
                            ? "Acquire Asset"
                            : "Insufficient Company KVC"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.infoStrip}>
          <div className={styles.infoItem}>
            <span className={styles.infoGlyph}>▣</span>
            <div>
              <strong>Company Authority</strong>
              <small>Aircraft purchasing remains restricted to Operations.</small>
            </div>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoGlyph}>◎</span>
            <div>
              <strong>Economic Asset First</strong>
              <small>Acquisition creates the economic record and ledger entry.</small>
            </div>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoGlyph}>⌁</span>
            <div>
              <strong>No Automatic Fleet Mutation</strong>
              <small>Fleet registration remains a separate Operations decision.</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

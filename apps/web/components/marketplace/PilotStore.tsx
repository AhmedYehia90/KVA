import {purchasePilotItemAction} from "@/app/pilot/economy/actions";
import {MarketplaceThumbnail} from "@/components/marketplace/MarketplaceThumbnail";
import {
  getMarketplaceThumbnailAlt,
  getPilotMarketplaceThumbnail,
} from "@/lib/marketplaceVisuals";
import styles from "./MarketplacePremium.module.css";

type PilotStoreProps = {
  items: any[];
  balance: number;
  money: (value: number) => string;
};

function categoryLabel(value: string | null | undefined) {
  return String(value ?? "Pilot item").replace(/_/g, " ");
}

export function PilotStore({items, balance, money}: PilotStoreProps) {
  return (
    <section className={styles.shell} id="pilot-marketplace">
      <div className={styles.content}>
        <div className={styles.headingRow}>
          <div className={styles.headingGroup}>
            <div className={styles.icon} aria-hidden="true">✦</div>
            <div>
              <p className={styles.eyebrow}>KVA OS Marketplace</p>
              <div className={styles.titleLine}>
                <h2 className={styles.title}>Pilot Store</h2>
                <span className={styles.accessBadge}>Pilot access only</span>
              </div>
              <p className={styles.subtitle}>
                Personalize your journey with identity, progression and cosmetic
                rewards. Aircraft and fleet authority never appear here.
              </p>
            </div>
          </div>

          <div className={styles.balance}>
            <small>KVA Credits</small>
            <strong>{money(balance)}</strong>
          </div>
        </div>

        <div className={styles.chips} aria-label="Pilot Marketplace categories">
          <span className={styles.chipActive}>All Items</span>
          <span className={styles.chip}>Badges</span>
          <span className={styles.chip}>Certificates</span>
          <span className={styles.chip}>Passport</span>
          <span className={styles.chip}>Themes</span>
          <span className={styles.chip}>Collectibles</span>
          <span className={styles.chip}>Liveries</span>
        </div>

        <div className={styles.grid}>
          {items.length === 0 ? (
            <div className={styles.empty}>No Pilot Marketplace items are currently available.</div>
          ) : null}

          {items.map((item: any) => {
            const unlock = item.unlock ?? {};
            const state = String(unlock.state ?? "UNAVAILABLE");
            const requirements = unlock.requirements ?? {};
            const requirementParts: string[] = [];

            if (Number(requirements.minimumCareerXp ?? 0) > 0) {
              requirementParts.push(`${requirements.minimumCareerXp} Career XP`);
            }
            if (Number(requirements.minimumFlights ?? 0) > 0) {
              requirementParts.push(`${requirements.minimumFlights} flights`);
            }
            if (requirements.requiredRankCode) {
              requirementParts.push(`Rank ${requirements.requiredRankCode}`);
            }
            if (requirements.requiredMilestoneCode) {
              requirementParts.push(
                requirements.requiredMilestoneTitle ?? requirements.requiredMilestoneCode,
              );
            }

            const available = state === "AVAILABLE";
            const owned = state === "OWNED";
            const stateClass = owned
              ? `${styles.state} ${styles.stateGood}`
              : available
                ? styles.state
                : `${styles.state} ${styles.stateWarn}`;

            return (
              <article className={styles.card} key={item.id}>
                <div className={styles.visual}>
                  <MarketplaceThumbnail
                    src={getPilotMarketplaceThumbnail(`${item.code ?? ""} ${item.name ?? ""}`)}
                    alt={getMarketplaceThumbnailAlt(item.name)}
                    badge={categoryLabel(item.category)}
                  />
                </div>

                <div className={styles.body}>
                  <div className={stateClass}>{state.replace(/_/g, " ")}</div>
                  <h3 className={styles.itemTitle}>{item.name}</h3>
                  <p className={styles.description}>{item.description}</p>

                  {requirementParts.length ? (
                    <p className={styles.requirement}>
                      <strong>Requires:</strong> {requirementParts.join(" · ")}
                    </p>
                  ) : null}

                  <div className={styles.priceRow}>
                    <span className={styles.price}>
                      <span className={styles.currencyDot}>K</span>
                      {money(Number(item.price))}
                    </span>
                  </div>

                  <div className={styles.action}>
                    {owned ? (
                      <button className={styles.buttonOwned} type="button" disabled>
                        Owned
                      </button>
                    ) : available ? (
                      <form action={purchasePilotItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button className={styles.button} type="submit">
                          Purchase
                        </button>
                      </form>
                    ) : (
                      <button className={styles.buttonDisabled} type="button" disabled>
                        {state.replace(/_/g, " ")}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.infoStrip}>
          <div className={styles.infoItem}>
            <span className={styles.infoGlyph}>✧</span>
            <div>
              <strong>Earn & Unlock</strong>
              <small>Flights, milestones and events unlock your journey.</small>
            </div>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoGlyph}>◇</span>
            <div>
              <strong>No Pay-to-Win</strong>
              <small>Career evidence matters more than spending.</small>
            </div>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoGlyph}>✓</span>
            <div>
              <strong>Real Economy State</strong>
              <small>Ownership and eligibility come from KVA OS records.</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

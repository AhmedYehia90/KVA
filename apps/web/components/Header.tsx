import Image from "next/image";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {createClient} from "@/lib/supabase/server";
import {LanguageSelector} from "./LanguageSelector";
import {signOutAction} from "./actions";
import {
  PremiumPageContext,
  PremiumSidebarNav,
  type PremiumNavItem,
} from "./PremiumNavigation";

const publicNavigation = [
  {href: "/", key: "home", icon: "⌂"},
  {href: "/fleet", key: "fleet", icon: "✦"},
  {href: "/live-flights", key: "liveFlights", icon: "◉"},
  {href: "/pilots", key: "pilots", icon: "♙"},
  {href: "/about", key: "about", icon: "i"},
] as const;

export async function Header() {
  const t = await getTranslations("Navigation");
  const common = await getTranslations("Common");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  const authenticatedNavigation: PremiumNavItem[] = [
    {href: "/pilot/dashboard", label: "Dashboard", icon: "⌂"},
    {href: "/pilot/passport", label: "Pilot Passport", icon: "◉"},
    {href: "/pilot/flights", label: "Flights", icon: "✈"},
    {href: "/pilot/bookings", label: "My Bookings", icon: "▣"},
    {href: "/pilot/pireps", label: "PIREPs", icon: "▤"},
    {href: "/pilot/economy", label: "Career & Economy", icon: "◇"},
    {href: "/fleet", label: t("fleet"), icon: "✦"},
    {href: "/pilot/history", label: "Museum & History", icon: "◆"},
    {href: "/airports", label: "Living Airports", icon: "◎"},
    {href: "/operations", label: "Operations", icon: "⚙"},
  ];

  const publicItems: PremiumNavItem[] = publicNavigation.map((item) => ({
    href: item.href,
    label: item.key === "home" ? "Home" : t(item.key),
    icon: item.icon,
  }));

  const navigationItems = user ? authenticatedNavigation : publicItems;
  const displayName = user?.email?.split("@")[0] ?? "Pilot";
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div
      className={`kvaPremiumShell ${
        user ? "kvaPremiumShellAuth" : "kvaPremiumShellPublic"
      }`}
    >
      <aside className="kvaSidebar" aria-label="KVA OS sidebar">
        <Link
          href="/"
          className="kvaSidebarBrand"
          aria-label={common("homeAria")}
        >
          <Image
            src="/brand/logo-reference.png"
            alt="Kalabsha Airlines"
            width={88}
            height={62}
            priority
          />
          <span className="kvaSidebarBrandText">
            <strong>Kalabsha Airlines</strong>
            <span>Fly To Dreams</span>
          </span>
        </Link>

        <div className="kvaSidebarSectionLabel">
          {user ? "KVA OS Workspace" : "Navigation"}
        </div>

        <PremiumSidebarNav items={navigationItems} />

        <div className="kvaSidebarFooter">
          <div className="kvaSidebarSystem">
            <span className="kvaSidebarSystemMark">K</span>
            <span>
              <strong>KVA OS</strong>
              <small>Premium Design System v1.2</small>
            </span>
          </div>
        </div>
      </aside>

      <header className="kvaTopbar">
        <Link
          href="/"
          className="kvaTopbarMobileBrand"
          aria-label={common("homeAria")}
        >
          <Image
            src="/brand/logo-reference.png"
            alt="Kalabsha Airlines"
            width={68}
            height={48}
            priority
          />
          <strong>Kalabsha Airlines</strong>
        </Link>

        <div className="kvaTopbarContext">
          <PremiumPageContext
            items={navigationItems}
            authenticated={Boolean(user)}
          />
          <span className="kvaTopbarDivider" aria-hidden="true" />
        </div>

        <div className="kvaTopbarActions">
          {user ? (
            <div className="kvaTopbarUser" aria-label="Signed in pilot">
              <span className="kvaTopbarAvatar" aria-hidden="true">
                {initial}
              </span>
              <span>
                <strong>{displayName}</strong>
                <small>KVA Pilot</small>
              </span>
            </div>
          ) : null}

          <LanguageSelector />

          {user ? (
            <form action={signOutAction}>
              <button className="button outline" type="submit">
                Logout
              </button>
            </form>
          ) : (
            <Link className="button outline" href="/pilots/login">
              {t("pilotLogin")}
            </Link>
          )}
        </div>

        <details className="kvaMobileNav">
          <summary>
            <span aria-hidden="true">☰</span>
            <span>Menu</span>
          </summary>
          <div className="kvaMobilePanel">
            <PremiumSidebarNav items={navigationItems} />
          </div>
        </details>
      </header>
    </div>
  );
}

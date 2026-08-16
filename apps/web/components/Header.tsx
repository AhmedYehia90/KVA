import Image from "next/image";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {createClient} from "@/lib/supabase/server";
import {LanguageSelector} from "./LanguageSelector";
import {signOutAction} from "./actions";
import mobileStyles from "./HeaderMobile.module.css";

const publicNavigation = [
  {href: "/fleet", key: "fleet"},
  {href: "/live-flights", key: "liveFlights"},
  {href: "/pilots", key: "pilots"},
  {href: "/about", key: "about"},
] as const;

export async function Header() {
  const t = await getTranslations("Navigation");
  const common = await getTranslations("Common");
  const supabase = await createClient();

  const {
    data: {user},
  } = await supabase.auth.getUser();

  const navigationItems = user
    ? [
        {href: "/pilot/dashboard", label: "Dashboard"},
        {href: "/operations", label: "Operations"},
        {href: "/pilot/flights", label: "Flights"},
        {href: "/pilot/bookings", label: "My Bookings"},
        {href: "/pilot/pireps", label: "PIREPs"},
        {href: "/pilot/history", label: "History"},
        {href: "/airports", label: "Airports"},
        {href: "/fleet", label: t("fleet")},
      ]
    : publicNavigation.map((item) => ({
        href: item.href,
        label: t(item.key),
      }));

  return (
    <header className={`nav ${mobileStyles.header}`}>
      <div className="container navin">
        <Link href="/" className="brand" aria-label={common("homeAria")}>
          <Image
            src="/brand/logo-reference.png"
            alt="Kalabsha Airlines"
            width={108}
            height={76}
            priority
          />

          <div>
            <strong>Kalabsha Airlines</strong>
            <div className="tag">Fly To Dreams</div>
          </div>
        </Link>

        <nav className="links" aria-label={t("mainNavigation")}>
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="navActions">
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

        <details className={mobileStyles.mobileMenu}>
          <summary className={mobileStyles.summary}>
            <span className={mobileStyles.summaryLabel}>
              <span className={mobileStyles.menuIcon} aria-hidden="true">
                ☰
              </span>
              Menu
            </span>
            <span className={mobileStyles.chevron} aria-hidden="true">
              ▾
            </span>
          </summary>

          <nav
            className={mobileStyles.panel}
            aria-label={`${t("mainNavigation")} mobile`}
          >
            {navigationItems.map((item) => (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={mobileStyles.link}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

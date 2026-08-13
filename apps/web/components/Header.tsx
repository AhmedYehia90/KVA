import Image from "next/image";
import Link from "next/link";
import {getTranslations} from "next-intl/server";
import {createClient} from "@/lib/supabase/server";
import {LanguageSelector} from "./LanguageSelector";
import {signOutAction} from "./actions";

const publicNavigation = [
  {href: "/fleet", key: "fleet"},
  {href: "/live-flights", key: "liveFlights"},
  {href: "/pilots", key: "pilots"},
  {href: "/about", key: "about"}
] as const;

export async function Header() {
  const t = await getTranslations("Navigation");
  const common = await getTranslations("Common");
  const supabase = await createClient();

  const {
    data: {user}
  } = await supabase.auth.getUser();

  return (
    <header className="nav">
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
          {user ? (
            <>
              <Link href="/pilot/dashboard">Dashboard</Link>
              <Link href="/operations">Operations</Link>
              <Link href="/pilot/flights">Flights</Link>
              <Link href="/pilot/bookings">My Bookings</Link>
              <Link href="/pilot/pireps">PIREPs</Link>
              <Link href="/pilot/history">History</Link>
              <Link href="/airports">Airports</Link>
              <Link href="/fleet">{t("fleet")}</Link>
            </>
          ) : (
            publicNavigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {t(item.key)}
              </Link>
            ))
          )}
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
      </div>
    </header>
  );
}

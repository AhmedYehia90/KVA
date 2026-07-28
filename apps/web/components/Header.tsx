import Image from "next/image";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {LanguageSelector} from "./LanguageSelector";

const navigation = [
  {href: "/fleet", key: "fleet"},
  {href: "/live-flights", key: "liveFlights"},
  {href: "/pilots", key: "pilots"},
  {href: "/about", key: "about"}
] as const;

export function Header() {
  const t = useTranslations("Navigation");
  const common = useTranslations("Common");

  return (
    <header className="nav">
      <div className="container navin">
        <Link
          href="/"
          className="brand"
          aria-label={common("homeAria")}
        >
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
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="navActions">
          <LanguageSelector />
          <Link className="button outline" href="/pilots/login">
            {t("pilotLogin")}
          </Link>
        </div>
      </div>
    </header>
  );
}

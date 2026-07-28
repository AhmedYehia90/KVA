import Image from "next/image";
import Link from "next/link";

const navigation = [
  { href: "/fleet", label: "Fleet" },
  { href: "/live-flights", label: "Live Flights" },
  { href: "/pilots", label: "Pilots" },
  { href: "/about", label: "About" },
] as const;

export function Header() {
  return (
    <header className="nav">
      <div className="container navin">
        <Link
          href="/"
          className="brand"
          aria-label="Kalabsha Airlines home"
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

        <nav className="links" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="button outline" href="/pilots/login">
          Pilot Login
        </Link>
      </div>
    </header>
  );
}

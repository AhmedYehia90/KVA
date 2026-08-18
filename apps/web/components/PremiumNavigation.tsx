"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

export type PremiumNavItem = {
  href: string;
  label: string;
  icon: string;
};

function matches(pathname: string, href: string) {
  // UI-only home alias: a signed-in pilot viewing "/" sees Dashboard highlighted.
  // This does not redirect and does not change any route.
  if (pathname === "/" && href === "/pilot/dashboard") return true;
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function PremiumSidebarNav({
  items,
}: {
  items: PremiumNavItem[];
}) {
  const pathname = usePathname();

  return (
    <nav className="kvaSidebarNav" aria-label="KVA OS navigation">
      {items.map((item) => {
        const active = matches(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`kvaSidebarLink ${
              active ? "kvaSidebarLinkActive" : ""
            }`}
            aria-current={active ? "page" : undefined}
          >
            <span className="kvaSidebarIcon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PremiumPageContext({
  items,
  authenticated,
}: {
  items: PremiumNavItem[];
  authenticated: boolean;
}) {
  const pathname = usePathname();

  const active = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => matches(pathname, item.href));

  const resolvedLabel =
    active?.label ??
    (authenticated && pathname === "/"
      ? "Dashboard"
      : authenticated
        ? "Workspace"
        : "Fly To Dreams");

  return (
    <div className="kvaPageContext">
      <span>{authenticated ? "KVA OS" : "Kalabsha Airlines"}</span>
      <strong>{resolvedLabel}</strong>
    </div>
  );
}

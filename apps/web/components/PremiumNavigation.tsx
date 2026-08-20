"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {
  BadgeCheck,
  Bot,
  Briefcase,
  BrainCircuit,
  Building2,
  CalendarDays,
  ChevronRight,
  Circle,
  ClipboardCheck,
  FileText,
  House,
  Info,
  Landmark,
  Layers3,
  Plane,
  PlaneTakeoff,
  RadioTower,
  Settings,
  SlidersHorizontal,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

export type PremiumNavItem = {
  href: string;
  label: string;
  icon: string;
};

function matches(pathname: string, href: string) {
  // UI-only home alias: a signed-in pilot viewing "/" sees Dashboard highlighted.
  // This does not redirect and does not change any route.
    if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

const iconByHref: Record<string, LucideIcon> = {
  "/": House,
  "/pilot/dashboard": House,
  "/pilot/flights": Plane,
  "/pilot/bookings": ClipboardCheck,
  "/pilot/pireps": FileText,
  "/pilot/passport": BadgeCheck,
  "/pilot/economy": Briefcase,
  "/fleet": PlaneTakeoff,
  "/pilot/history": Landmark,
  "/airports": RadioTower,
  "/operations": SlidersHorizontal,
  "/live-flights": RadioTower,
  "/pilots": Users,
  "/about": Info,

  // Future-ready UI mappings only. These do not create or change routes.
  "/marketplace": ShoppingCart,
  "/events": CalendarDays,
  "/pilot/mentor": BrainCircuit,
  "/mentor": BrainCircuit,
  "/airbot": Bot,
  "/settings": Settings,
};

function iconFromLabel(label: string): LucideIcon {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("market")) return ShoppingCart;
  if (normalized.includes("event")) return CalendarDays;
  if (normalized.includes("passport")) return BadgeCheck;
  if (normalized.includes("career") || normalized.includes("economy")) return Briefcase;
  if (normalized.includes("museum") || normalized.includes("history")) return Landmark;
  if (normalized.includes("mentor") || normalized.includes("ai")) return BrainCircuit;
  if (normalized.includes("airbot") || normalized.includes("dispatcher")) return Bot;
  if (normalized.includes("operation")) return SlidersHorizontal;
  if (normalized.includes("fleet")) return PlaneTakeoff;
  if (normalized.includes("airport") || normalized.includes("live flight")) return RadioTower;
  if (normalized.includes("booking")) return ClipboardCheck;
  if (normalized.includes("pirep")) return FileText;
  if (normalized.includes("flight")) return Plane;
  if (normalized.includes("dashboard") || normalized === "home") return House;
  if (normalized.includes("pilot")) return Users;
  if (normalized.includes("setting")) return Settings;

  return Circle;
}

function getSidebarIcon(item: PremiumNavItem): LucideIcon {
  return iconByHref[item.href] ?? iconFromLabel(item.label);
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
        const Icon = getSidebarIcon(item);

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
              <Icon />
            </span>

            <span className="kvaSidebarLabel">{item.label}</span>

            {active ? (
              <ChevronRight
                className="kvaSidebarChevron"
                aria-hidden="true"
              />
            ) : null}
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
    pathname === "/"
      ? "Home"
      : active?.label ??
        (authenticated
          ? "Workspace"
          : "Fly To Dreams");

  return (
    <div className="kvaPageContext">
      <span>{authenticated ? "KVA OS" : "Kalabsha Airlines"}</span>
      <strong>{resolvedLabel}</strong>
    </div>
  );
}

import type { Icon } from "@/shared/ui/icon/icon";
import { AnalyticsIcon, EditNoteIcon, GroupIcon, ReceiptLongIcon } from "@/shared/ui/icon/icons";
import { routes } from "@/shared/web/routes";

export type Section = {
  readonly label: string;
  readonly href: string;
  readonly icon: Icon;
  // Paths that belong to it, besides its own
  readonly owns: (pathname: string) => boolean;
};

// The app's top-level places, in tab order. A tab's label is also its screen's title.
export const sections = {
  today: {
    label: "Hôm nay",
    href: routes.today,
    icon: EditNoteIcon,
    owns: (pathname) =>
      pathname === routes.today ||
      pathname.startsWith(`${routes.days}/`) ||
      pathname === routes.history ||
      pathname === routes.reminders,
  },
  orders: {
    label: "Đơn hàng",
    href: routes.orders,
    icon: ReceiptLongIcon,
    // Products are what orders are made of, and reached from them
    owns: (pathname) =>
      pathname === routes.orders ||
      pathname.startsWith(`${routes.orders}/`) ||
      pathname === routes.products ||
      pathname.startsWith(`${routes.products}/`),
  },
  customers: {
    label: "Khách hàng",
    href: routes.customers,
    icon: GroupIcon,
    owns: (pathname) =>
      pathname === routes.customers || pathname.startsWith(`${routes.customers}/`),
  },
  reports: {
    label: "Báo cáo",
    href: routes.reports,
    icon: AnalyticsIcon,
    owns: (pathname) => pathname === routes.reports,
  },
} as const satisfies Record<string, Section>;

const tabs: ReadonlyArray<Section> = Object.values(sections);

// The tab a path belongs to; Today for anything else
export function tabFor(pathname: string): string {
  return tabs.find((tab) => tab.owns(pathname))?.href ?? routes.today;
}

// A tab's own path, or Today: never a path from outside the app's tabs
export function knownTab(path: string | undefined): string {
  return tabs.find((tab) => tab.href === path)?.href ?? routes.today;
}

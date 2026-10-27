// Every path the app serves, so a link, a redirect and the route behind them cannot drift apart
export const routes = {
  today: "/",
  days: "/days",
  history: "/history",
  reminders: "/reminders",
  orders: "/orders",
  newOrder: "/orders/new",
  customers: "/customers",
  newCustomer: "/customers/new",
  products: "/products",
  deleted: "/deleted",
  reports: "/reports",
  signIn: "/sign-in",
  setup: "/setup",
  signOut: "/sign-out",
  settings: "/settings",
  componentGallery: "/dev/ui",
  // Static files in public/, written by `pnpm icons`
  manifest: "/manifest.webmanifest",
  icon: "/icon.svg",
  appleIcon: "/apple-icon.png",
} as const;

// The search box on the history screen sends its words under this name
export const searchQueryParameter = "q";

export function orderPath(id: string): string {
  return `${routes.orders}/${id}`;
}

export function editOrderPath(id: string): string {
  return `${orderPath(id)}/edit`;
}

export function productPath(id: string): string {
  return `${routes.products}/${id}`;
}

export function customerPath(id: string): string {
  return `${routes.customers}/${id}`;
}

export function editCustomerPath(id: string): string {
  return `${customerPath(id)}/edit`;
}

// The tab the settings were opened from, where their back arrow returns
export const settingsFromParameter = "from";

export function settingsPath(from: string): string {
  return `${routes.settings}?${new URLSearchParams({ [settingsFromParameter]: from })}`;
}

// Today has one address, the home screen, so a day page never shows what the home screen shows. Days are YYYY-MM-DD
// text, so the browser can build a path from the date picker without loading Temporal.
export function dayPath(day: string, today: string): string {
  return day === today ? routes.today : `${routes.days}/${day}`;
}

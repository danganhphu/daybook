import { routes } from "@/shared/web/routes";

// The order list's filters live in its URL, so back, reload and a shared link all keep them
export type OrdersQuery = {
  // YYYY-MM
  readonly month?: string | undefined;
  // "" for all, as the screen holds it
  readonly status?: OrderStatusFilter | "" | undefined;
  readonly kind?: string | undefined;
};

export const orderStatusFilters = ["undelivered", "owed"] as const;

export type OrderStatusFilter = (typeof orderStatusFilters)[number];

export function ordersPath(query: OrdersQuery): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (typeof value === "string" && value !== "") {
      params.set(name, value);
    }
  }
  const search = params.toString();

  return search === "" ? routes.orders : `${routes.orders}?${search}`;
}

// The order form for a customer picked on their page
export function newOrderPath(customerId?: string): string {
  return customerId === undefined
    ? routes.newOrder
    : `${routes.newOrder}?${new URLSearchParams({ customer: customerId }).toString()}`;
}

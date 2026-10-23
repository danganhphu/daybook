import { routes } from "@/shared/web/routes";

// The customer list's search and filters live in its URL
export type CustomersQuery = {
  readonly q?: string | undefined;
  readonly kind?: string | undefined;
  // "1" lists the hidden ones
  readonly hidden?: "1" | undefined;
};

export function customersPath(query: CustomersQuery): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (typeof value === "string" && value !== "") {
      params.set(name, value);
    }
  }
  const search = params.toString();

  return search === "" ? routes.customers : `${routes.customers}?${search}`;
}

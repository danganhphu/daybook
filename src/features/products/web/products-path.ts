import { routes } from "@/shared/web/routes";

// The product list's search and the hidden view live in its URL
export type ProductsQuery = {
  readonly q?: string | undefined;
  // "1" lists the hidden ones
  readonly hidden?: "1" | undefined;
};

export function productsPath(query: ProductsQuery): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (typeof value === "string" && value !== "") {
      params.set(name, value);
    }
  }
  const search = params.toString();

  return search === "" ? routes.products : `${routes.products}?${search}`;
}

import type { OtherNameView } from "@/shared/web/other-name-view";

// What the browser gets for products: plain values that cross the server-client boundary. Money is whole đồng.

export type ProductRowView = {
  readonly id: string;
  readonly name: string;
  // "12 đơn"; none for a product never sold
  readonly detail: string | undefined;
  readonly lastPrice: number | undefined;
};

export type ProductsView = {
  // As typed, to fill the box again
  readonly query: string;
  readonly showingHidden: boolean;
  readonly rows: ReadonlyArray<ProductRowView>;
  readonly more: boolean;
  readonly filtered: boolean;
};

export type ProductScreenView = {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly hidden: boolean;
  // The product it was merged into: hidden for good, its order lines are there now
  readonly mergedInto: string | undefined;
  readonly lastPrice: number | undefined;
  readonly orderCount: number;
  readonly otherNames: ReadonlyArray<OtherNameView>;
};

import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Archival, Audit } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { requiredTextSchema } from "@/shared/domain/short-text";

import { productNameMaxLength } from "./product-limits";

// Read as a module: `import * as Products`. Made where an order line names something new, so there is no catalogue
// to fill in first. Its last price is read from the orders, never stored here.

export const productIdSchema = z.uuid().brand<"ProductId">();

export type ProductId = z.infer<typeof productIdSchema>;

export const productNameSchema = requiredTextSchema(productNameMaxLength, {
  empty: "Chưa nhập tên sản phẩm",
  tooLong: `Tên sản phẩm tối đa ${productNameMaxLength} ký tự`,
}).brand<"ProductName">();

export type ProductName = z.infer<typeof productNameSchema>;

type ProductFields = {
  readonly id: ProductId;
  readonly name: ProductName;
  readonly audit: Audit;
};

export type ActiveProduct = ProductFields & { readonly status: "active" };

export type ArchivedProduct = ProductFields & {
  readonly status: "archived";
  readonly archival: Archival;
  // The product it was merged into, when a merge hid it; its order lines went there
  readonly mergedInto: ProductId | undefined;
};

export type Product = ActiveProduct | ArchivedProduct;

export function create(name: ProductName, by: AccountId, at: Temporal.Instant): ActiveProduct {
  return {
    status: "active",
    id: productIdSchema.parse(uuidv7()),
    name,
    audit: Audits.start(by, at),
  };
}

// Old orders show the new name too: they name the product by id
export function rename(
  product: Product,
  name: ProductName,
  by: AccountId,
  at: Temporal.Instant,
): Product {
  return { ...product, name, audit: Audits.change(product.audit, by, at) };
}

// Gone from the suggestions; still on every order that sold it
export function archive(
  product: Product,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedProduct, "product_archived"> {
  if (product.status === "archived") {
    return err("product_archived");
  }

  return ok({
    ...product,
    status: "archived",
    audit: Audits.change(product.audit, by, at),
    archival: Audits.archival(by, at),
    mergedInto: undefined,
  });
}

// A merged product stays hidden: its order lines belong to the one it was merged into now
export function restore(
  product: Product,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveProduct, "product_not_archived" | "product_merged"> {
  if (product.status === "active") {
    return err("product_not_archived");
  }
  if (product.mergedInto !== undefined) {
    return err("product_merged");
  }

  const { archival: _archival, mergedInto: _mergedInto, ...fields } = product;

  return ok({ ...fields, status: "active", audit: Audits.change(product.audit, by, at) });
}

// Hidden for good, naming the product kept in its place. A hidden one can be merged; a merged one cannot again.
export function mergeInto(
  product: Product,
  into: ActiveProduct,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedProduct, "product_merged" | "merge_into_itself"> {
  if (product.id === into.id) {
    return err("merge_into_itself");
  }
  if (product.status === "archived" && product.mergedInto !== undefined) {
    return err("product_merged");
  }

  return ok({
    ...product,
    status: "archived",
    audit: Audits.change(product.audit, by, at),
    archival: product.status === "archived" ? product.archival : Audits.archival(by, at),
    mergedInto: into.id,
  });
}

// The kept product gains order lines and names in a merge; its version moves, so a change from a screen opened
// before the merge is refused, and two merges into it cannot interleave
export function absorbMerge(
  product: ActiveProduct,
  by: AccountId,
  at: Temporal.Instant,
): ActiveProduct {
  return { ...product, audit: Audits.change(product.audit, by, at) };
}

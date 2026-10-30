import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Archival, Audit, Deletion } from "@/shared/domain/audit";
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
  // Set when deleted: hidden by the same act, and in the trash; old orders still name it
  readonly deletion: Deletion | undefined;
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
    deletion: undefined,
  });
}

function shown(product: ArchivedProduct, by: AccountId, at: Temporal.Instant): ActiveProduct {
  const { archival: _archival, mergedInto: _mergedInto, deletion: _deletion, ...fields } = product;

  return { ...fields, status: "active", audit: Audits.change(product.audit, by, at) };
}

// A merged product stays hidden: its order lines belong to the one it was merged into now. A deleted one comes back
// from the trash, not from the hidden list.
export function restore(
  product: Product,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveProduct, "product_not_archived" | "product_merged" | "product_deleted"> {
  if (product.status === "active") {
    return err("product_not_archived");
  }
  if (product.mergedInto !== undefined) {
    return err("product_merged");
  }
  if (product.deletion !== undefined) {
    return err("product_deleted");
  }

  return ok(shown(product, by, at));
}

// Into the trash, hidden by the same act; orders that sold it keep its name. One merged into another is gone into it.
export function markDeleted(
  product: Product,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedProduct, "product_merged" | "product_deleted"> {
  if (product.status === "archived" && product.mergedInto !== undefined) {
    return err("product_merged");
  }
  if (product.status === "archived" && product.deletion !== undefined) {
    return err("product_deleted");
  }

  return ok({
    ...product,
    status: "archived",
    audit: Audits.change(product.audit, by, at),
    archival: product.status === "archived" ? product.archival : Audits.archival(by, at),
    mergedInto: undefined,
    deletion: Audits.deletion(by, at),
  });
}

// Back from the trash, shown; the caller checks its name is still free, as for one shown again
export function restoreDeleted(
  product: Product,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveProduct, "product_not_deleted"> {
  if (product.status === "active" || product.deletion === undefined) {
    return err("product_not_deleted");
  }

  return ok(shown(product, by, at));
}

// Hidden for good, naming the product kept in its place. A hidden one can be merged; a merged one cannot again.
export function mergeInto(
  product: Product,
  into: ActiveProduct,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedProduct, "product_merged" | "merge_into_itself" | "product_deleted"> {
  if (product.id === into.id) {
    return err("merge_into_itself");
  }
  if (product.status === "archived" && product.mergedInto !== undefined) {
    return err("product_merged");
  }
  if (product.status === "archived" && product.deletion !== undefined) {
    return err("product_deleted");
  }

  return ok({
    ...product,
    status: "archived",
    audit: Audits.change(product.audit, by, at),
    archival: product.status === "archived" ? product.archival : Audits.archival(by, at),
    mergedInto: into.id,
    deletion: undefined,
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

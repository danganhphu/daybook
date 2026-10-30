import { Temporal } from "temporal-polyfill/implementation";

import {
  productIdSchema,
  productNameSchema,
  type Product,
} from "@/features/products/domain/product";
import { productAliasIdSchema, type ProductAlias } from "@/features/products/domain/product-alias";
import { accountIdSchema } from "@/shared/domain/account-id";
import { searchText } from "@/shared/domain/search-text";
import {
  toArchival,
  toArchivalRow,
  toAudit,
  toAuditRow,
  toDeletion,
  toDeletionRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { productAliasTable } from "./product-alias.table";
import type { productTable } from "./product.table";

type ProductRow = typeof productTable.$inferSelect;
type AliasRow = typeof productAliasTable.$inferSelect;

export function toProduct(row: ProductRow): Product {
  const fields = {
    id: productIdSchema.parse(row.id),
    name: productNameSchema.parse(row.name),
    audit: toAudit(row),
  };
  const archival = toArchival(row);

  return archival === undefined
    ? { ...fields, status: "active" }
    : {
        ...fields,
        status: "archived",
        archival,
        mergedInto: row.mergedIntoId === null ? undefined : productIdSchema.parse(row.mergedIntoId),
        deletion: toDeletion(row),
      };
}

export function toProductRow(product: Product): ProductRow {
  return {
    id: product.id,
    name: product.name,
    searchName: searchText(product.name),
    mergedIntoId: product.status === "archived" ? (product.mergedInto ?? null) : null,
    ...toAuditRow(product.audit),
    ...toArchivalRow(product.status === "archived" ? product.archival : undefined),
    ...toDeletionRow(product.status === "archived" ? product.deletion : undefined),
  };
}

export function toProductAlias(row: AliasRow): ProductAlias {
  return {
    id: productAliasIdSchema.parse(row.id),
    productId: productIdSchema.parse(row.productId),
    name: productNameSchema.parse(row.name),
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    createdBy: accountIdSchema.parse(row.createdBy),
  };
}

export function toProductAliasRow(alias: ProductAlias): AliasRow {
  return {
    id: alias.id,
    productId: alias.productId,
    name: alias.name,
    searchName: searchText(alias.name),
    createdAt: alias.createdAt.epochMilliseconds,
    createdBy: alias.createdBy,
  };
}

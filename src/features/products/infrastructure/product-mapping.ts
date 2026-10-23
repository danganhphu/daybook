import {
  productIdSchema,
  productNameSchema,
  type Product,
} from "@/features/products/domain/product";
import { searchText } from "@/shared/domain/search-text";
import {
  toArchival,
  toArchivalRow,
  toAudit,
  toAuditRow,
} from "@/shared/infrastructure/d1/audit-mapping";

import type { productTable } from "./product.table";

type ProductRow = typeof productTable.$inferSelect;

export function toProduct(row: ProductRow): Product {
  const fields = {
    id: productIdSchema.parse(row.id),
    name: productNameSchema.parse(row.name),
    audit: toAudit(row),
  };
  const archival = toArchival(row);

  return archival === undefined
    ? { ...fields, status: "active" }
    : { ...fields, status: "archived", archival };
}

export function toProductRow(product: Product): ProductRow {
  return {
    id: product.id,
    name: product.name,
    searchName: searchText(product.name),
    ...toAuditRow(product.audit),
    ...toArchivalRow(product.status === "archived" ? product.archival : undefined),
  };
}

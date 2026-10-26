import { eq, getTableColumns, inArray } from "drizzle-orm";

import type {
  ProductAliasWrites,
  ProductWrites,
} from "@/features/products/application/product-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { productAliasTable } from "./product-alias.table";
import { toProductAliasRow, toProductRow } from "./product-mapping";
import { productTable } from "./product.table";

const productsPerInsert = Math.floor(
  d1MaxBoundParameters / Object.keys(getTableColumns(productTable)).length,
);

const aliasesPerInsert = Math.floor(
  d1MaxBoundParameters / Object.keys(getTableColumns(productAliasTable)).length,
);

export function createProductWrites(db: Database, batch: Batch): ProductWrites {
  return {
    add(products) {
      const rows = products.map(toProductRow);
      for (let start = 0; start < rows.length; start += productsPerInsert) {
        batch.enlist(db.insert(productTable).values(rows.slice(start, start + productsPerInsert)));
      }
    },

    // Everything but the creation, which the database refuses to change; the version trigger refuses a stale write
    update(product) {
      const {
        id: _id,
        createdAt: _createdAt,
        createdBy: _createdBy,
        ...changes
      } = toProductRow(product);
      batch.enlist(db.update(productTable).set(changes).where(eq(productTable.id, product.id)));
    },
  };
}

export function createProductAliasWrites(db: Database, batch: Batch): ProductAliasWrites {
  return {
    add(aliases) {
      const rows = aliases.map(toProductAliasRow);
      for (let start = 0; start < rows.length; start += aliasesPerInsert) {
        batch.enlist(
          db.insert(productAliasTable).values(rows.slice(start, start + aliasesPerInsert)),
        );
      }
    },

    remove(ids) {
      for (let start = 0; start < ids.length; start += d1MaxBoundParameters) {
        batch.enlist(
          db
            .delete(productAliasTable)
            .where(inArray(productAliasTable.id, ids.slice(start, start + d1MaxBoundParameters))),
        );
      }
    },
  };
}

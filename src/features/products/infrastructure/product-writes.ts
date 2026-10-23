import { getTableColumns } from "drizzle-orm";

import type { ProductWrites } from "@/features/products/application/product-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { toProductRow } from "./product-mapping";
import { productTable } from "./product.table";

const productsPerInsert = Math.floor(
  d1MaxBoundParameters / Object.keys(getTableColumns(productTable)).length,
);

export function createProductWrites(db: Database, batch: Batch): ProductWrites {
  return {
    add(products) {
      const rows = products.map(toProductRow);
      for (let start = 0; start < rows.length; start += productsPerInsert) {
        batch.enlist(db.insert(productTable).values(rows.slice(start, start + productsPerInsert)));
      }
    },
  };
}

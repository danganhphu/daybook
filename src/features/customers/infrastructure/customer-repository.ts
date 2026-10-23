import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { containsLiterally } from "@/shared/infrastructure/d1/like-pattern";

import { toCustomer } from "./customer-mapping";
import { customerTable } from "./customer.table";

export function createCustomerRepository(db: Database): CustomerRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(customerTable).where(eq(customerTable.id, id)).limit(1);

      return row === undefined ? undefined : toCustomer(row);
    },

    async getMany(ids) {
      if (ids.length === 0) {
        return [];
      }
      const rows = await db
        .select()
        .from(customerTable)
        .where(inArray(customerTable.id, [...ids]));

      return rows.map(toCustomer);
    },

    async list(filter, limit) {
      const rows = await db
        .select()
        .from(customerTable)
        .where(
          and(
            filter.status === "active"
              ? isNull(customerTable.archivedAt)
              : isNotNull(customerTable.archivedAt),
            filter.kindId === undefined ? undefined : eq(customerTable.kindId, filter.kindId),
            ...(filter.search === undefined
              ? []
              : filter.search
                  .split(" ")
                  .map((word) => containsLiterally(customerTable.searchName, word))),
          ),
        )
        .orderBy(asc(customerTable.searchName), asc(customerTable.id))
        .limit(limit);

      return rows.map(toCustomer);
    },
  };
}

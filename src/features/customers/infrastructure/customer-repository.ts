import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { CustomerAlias } from "@/features/customers/domain/customer-alias";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { containsLiterally } from "@/shared/infrastructure/d1/like-pattern";
import { d1MaxBoundParameters } from "@/shared/infrastructure/d1/limits";

import { customerAliasTable } from "./customer-alias.table";
import { toCustomer, toCustomerAlias } from "./customer-mapping";
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
      const words = filter.search?.split(" ") ?? [];
      // Every word in the name and area, or every word in one other name of the same customer
      const found =
        words.length === 0
          ? undefined
          : or(
              and(...words.map((word) => containsLiterally(customerTable.searchName, word))),
              sql`exists (select 1 from ${customerAliasTable} where ${customerAliasTable.customerId} = ${customerTable.id} and ${and(...words.map((word) => containsLiterally(customerAliasTable.searchName, word)))})`,
            );
      const rows = await db
        .select()
        .from(customerTable)
        .where(
          and(
            filter.status === "active"
              ? isNull(customerTable.archivedAt)
              : isNotNull(customerTable.archivedAt),
            filter.kindId === undefined ? undefined : eq(customerTable.kindId, filter.kindId),
            found,
          ),
        )
        .orderBy(asc(customerTable.searchName), asc(customerTable.id))
        .limit(limit);

      return rows.map(toCustomer);
    },

    async aliasesOf(ids) {
      const byCustomer = new Map<CustomerAlias["customerId"], CustomerAlias[]>();
      for (let start = 0; start < ids.length; start += d1MaxBoundParameters) {
        // oxlint-disable-next-line no-await-in-loop -- one chunk per query, under D1's bound-parameter limit
        const rows = await db
          .select()
          .from(customerAliasTable)
          .where(
            inArray(customerAliasTable.customerId, ids.slice(start, start + d1MaxBoundParameters)),
          )
          .orderBy(asc(customerAliasTable.createdAt), asc(customerAliasTable.id));
        for (const alias of rows.map(toCustomerAlias)) {
          byCustomer.set(alias.customerId, [...(byCustomer.get(alias.customerId) ?? []), alias]);
        }
      }

      return byCustomer;
    },

    async getAlias(id) {
      const [row] = await db
        .select()
        .from(customerAliasTable)
        .where(eq(customerAliasTable.id, id))
        .limit(1);

      return row === undefined ? undefined : toCustomerAlias(row);
    },
  };
}

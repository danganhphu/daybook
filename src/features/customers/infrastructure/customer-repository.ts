import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import type { ArchivedCustomer } from "@/features/customers/domain/customer";
import type { CustomerAlias } from "@/features/customers/domain/customer-alias";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { Database } from "@/shared/infrastructure/d1/database";
import { containsLiterally } from "@/shared/infrastructure/d1/like-pattern";
import { readInChunks } from "@/shared/infrastructure/d1/limits";

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
      const rows = await readInChunks(ids, (chunk) =>
        db
          .select()
          .from(customerTable)
          .where(inArray(customerTable.id, [...chunk])),
      );

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
              : and(isNotNull(customerTable.archivedAt), isNull(customerTable.deletedAt)),
            filter.kindId === undefined ? undefined : eq(customerTable.kindId, filter.kindId),
            found,
          ),
        )
        .orderBy(asc(customerTable.searchName), asc(customerTable.id))
        .limit(limit);

      return rows.map(toCustomer);
    },

    async listDeleted(since, limit) {
      const rows = await db
        .select()
        .from(customerTable)
        .where(
          and(
            isNotNull(customerTable.deletedAt),
            gte(customerTable.deletedAt, since.epochMilliseconds),
          ),
        )
        .orderBy(desc(customerTable.deletedAt), desc(customerTable.id))
        .limit(limit);

      return rows
        .map(toCustomer)
        .filter((customer): customer is ArchivedCustomer => customer.status === "archived");
    },

    // Each customer's own aliases are in one chunk, so their order holds
    async aliasesOf(ids) {
      const rows = await readInChunks(ids, (chunk) =>
        db
          .select()
          .from(customerAliasTable)
          .where(inArray(customerAliasTable.customerId, [...chunk]))
          .orderBy(asc(customerAliasTable.createdAt), asc(customerAliasTable.id)),
      );
      const byCustomer = new Map<CustomerAlias["customerId"], CustomerAlias[]>();
      for (const alias of rows.map(toCustomerAlias)) {
        byCustomer.set(alias.customerId, [...(byCustomer.get(alias.customerId) ?? []), alias]);
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

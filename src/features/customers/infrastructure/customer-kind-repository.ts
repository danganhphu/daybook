import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, max, sql } from "drizzle-orm";

import { positionSchema, type ArchivedKind } from "@/features/customers/domain/customer-kind";
import type { CustomerKindRepository } from "@/features/customers/domain/customer-kind-repository";
import { searchText } from "@/shared/domain/search-text";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toCustomerKind } from "./customer-kind-mapping";
import { customerKindTable } from "./customer-kind.table";

export function createCustomerKindRepository(db: Database): CustomerKindRepository {
  return {
    async get(id) {
      const [row] = await db
        .select()
        .from(customerKindTable)
        .where(eq(customerKindTable.id, id))
        .limit(1);

      return row === undefined ? undefined : toCustomerKind(row);
    },

    // The owner's kinds are a handful: one query, no chunking
    async getMany(ids) {
      if (ids.length === 0) {
        return [];
      }
      const rows = await db
        .select()
        .from(customerKindTable)
        .where(inArray(customerKindTable.id, [...ids]));

      return rows.map(toCustomerKind);
    },

    async list() {
      const rows = await db
        .select()
        .from(customerKindTable)
        .where(isNull(customerKindTable.deletedAt))
        .orderBy(
          sql`${customerKindTable.archivedAt} is not null`,
          asc(customerKindTable.position),
          asc(customerKindTable.searchName),
        );

      return rows.map(toCustomerKind);
    },

    async listDeleted(since, limit) {
      const rows = await db
        .select()
        .from(customerKindTable)
        .where(
          and(
            isNotNull(customerKindTable.deletedAt),
            gte(customerKindTable.deletedAt, since.epochMilliseconds),
          ),
        )
        .orderBy(desc(customerKindTable.deletedAt), desc(customerKindTable.id))
        .limit(limit);

      return rows
        .map(toCustomerKind)
        .filter((kind): kind is ArchivedKind => kind.status === "archived");
    },

    async findActiveNamed(name) {
      const [row] = await db
        .select()
        .from(customerKindTable)
        .where(
          and(
            eq(customerKindTable.searchName, searchText(name)),
            isNull(customerKindTable.archivedAt),
          ),
        )
        .limit(1);

      return row === undefined ? undefined : toCustomerKind(row);
    },

    async nextPosition() {
      const [row] = await db
        .select({ last: max(customerKindTable.position) })
        .from(customerKindTable);

      return positionSchema.parse(row?.last === null || row?.last === undefined ? 0 : row.last + 1);
    },
  };
}

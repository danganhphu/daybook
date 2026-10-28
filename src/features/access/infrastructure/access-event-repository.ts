import { and, asc, desc, eq, gt, isNotNull, lte, max, or } from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";

import type { AccessEventRepository } from "@/features/access/domain/access-event-repository";
import { accountIdSchema } from "@/shared/domain/account-id";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toAccessEvent } from "./access-event-mapping";
import { accessEventTable } from "./access-event.table";

export function createAccessEventRepository(db: Database): AccessEventRepository {
  return {
    async get(id) {
      const [row] = await db
        .select()
        .from(accessEventTable)
        .where(eq(accessEventTable.id, id))
        .limit(1);

      return row === undefined ? undefined : toAccessEvent(row);
    },

    async listForAccount(accountId, limit) {
      const rows = await db
        .select()
        .from(accessEventTable)
        .where(
          or(eq(accessEventTable.accountId, accountId), eq(accessEventTable.actorId, accountId)),
        )
        .orderBy(desc(accessEventTable.occurredAt), desc(accessEventTable.id))
        .limit(limit);

      return rows.map(toAccessEvent);
    },

    async lastSignIns() {
      const rows = await db
        .select({ accountId: accessEventTable.accountId, at: max(accessEventTable.occurredAt) })
        .from(accessEventTable)
        .where(
          and(eq(accessEventTable.kind, "session_opened"), isNotNull(accessEventTable.accountId)),
        )
        .groupBy(accessEventTable.accountId);

      return new Map(
        rows.flatMap(({ accountId, at }) =>
          accountId === null || at === null
            ? []
            : [
                [
                  accountIdSchema.parse(accountId),
                  Temporal.Instant.fromEpochMilliseconds(at),
                ] as const,
              ],
        ),
      );
    },

    async listAfter(after, upTo, limit) {
      const at = after.occurredAt.epochMilliseconds;
      const rows = await db
        .select()
        .from(accessEventTable)
        .where(
          and(
            or(
              gt(accessEventTable.occurredAt, at),
              and(eq(accessEventTable.occurredAt, at), gt(accessEventTable.id, after.id)),
            ),
            lte(accessEventTable.occurredAt, upTo.epochMilliseconds),
          ),
        )
        .orderBy(asc(accessEventTable.occurredAt), asc(accessEventTable.id))
        .limit(limit);

      return rows.map(toAccessEvent);
    },

    async latest() {
      const [row] = await db
        .select()
        .from(accessEventTable)
        .orderBy(desc(accessEventTable.occurredAt), desc(accessEventTable.id))
        .limit(1);

      return row === undefined ? undefined : toAccessEvent(row);
    },
  };
}

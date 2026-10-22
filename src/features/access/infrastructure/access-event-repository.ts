import { and, desc, eq, isNotNull, max, or } from "drizzle-orm";
import { Temporal } from "temporal-polyfill/implementation";

import type { AccessEventRepository } from "@/features/access/domain/access-event-repository";
import { accountIdSchema } from "@/features/access/domain/account";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toAccessEvent } from "./access-event-mapping";
import { accessEventTable } from "./access-event.table";

export function createAccessEventRepository(db: Database): AccessEventRepository {
  return {
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
  };
}

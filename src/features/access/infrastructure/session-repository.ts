import { desc, eq } from "drizzle-orm";

import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toSession } from "./session-mapping";
import { sessionTable } from "./session.table";

export function createSessionRepository(db: Database): SessionRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(sessionTable).where(eq(sessionTable.id, id)).limit(1);

      return row === undefined ? undefined : toSession(row);
    },

    async listForAccount(accountId) {
      const rows = await db
        .select()
        .from(sessionTable)
        .where(eq(sessionTable.accountId, accountId))
        .orderBy(desc(sessionTable.lastSeenAt), desc(sessionTable.id));

      return rows.map(toSession);
    },
  };
}

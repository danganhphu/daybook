import { eq } from "drizzle-orm";

import { toSession } from "@/features/access/infrastructure/session-mapping";
import { sessionTable } from "@/features/access/infrastructure/session.table";
import type { PushSubscriptionRepository } from "@/features/notifications/domain/push-subscription-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toPushSubscription } from "./notification-mapping";
import { pushSubscriptionTable } from "./push-subscription.table";

export function createPushSubscriptionRepository(db: Database): PushSubscriptionRepository {
  async function findWhere(condition: ReturnType<typeof eq>) {
    const [row] = await db.select().from(pushSubscriptionTable).where(condition).limit(1);

    return row === undefined ? undefined : toPushSubscription(row);
  }

  return {
    get: (id) => findWhere(eq(pushSubscriptionTable.id, id)),
    findByEndpoint: (endpoint) => findWhere(eq(pushSubscriptionTable.endpoint, endpoint)),
    findBySession: (sessionId) => findWhere(eq(pushSubscriptionTable.sessionId, sessionId)),

    async listWithSessions(accountId) {
      const rows = await db
        .select({ subscription: pushSubscriptionTable, session: sessionTable })
        .from(pushSubscriptionTable)
        .innerJoin(sessionTable, eq(sessionTable.id, pushSubscriptionTable.sessionId))
        .where(accountId === undefined ? undefined : eq(pushSubscriptionTable.accountId, accountId))
        .orderBy(pushSubscriptionTable.createdAt);

      return rows.map((row) => ({
        subscription: toPushSubscription(row.subscription),
        session: toSession(row.session),
      }));
    },
  };
}

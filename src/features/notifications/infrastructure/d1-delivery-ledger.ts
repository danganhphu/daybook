import { and, eq, lt, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import type { DeliveryLedger } from "@/features/notifications/application/delivery-ledger";
import type { DeliveryKey } from "@/features/notifications/domain/delivery";
import type { Database } from "@/shared/infrastructure/d1/database";

import { notificationDeliveryTable } from "./notification-delivery.table";

function isFor(key: DeliveryKey) {
  return and(
    eq(notificationDeliveryTable.accountId, key.accountId),
    eq(notificationDeliveryTable.subject, key.subject),
    eq(notificationDeliveryTable.ref, key.ref),
    eq(notificationDeliveryTable.channel, key.channel),
  );
}

export function createDeliveryLedger(db: Database): DeliveryLedger {
  return {
    // Inserts the claim, or counts another attempt at one still claimed; a finished one matches neither, so nothing
    // comes back. D1 runs it as one statement, which settles two runs racing for the same delivery.
    async claim(key, at) {
      const claimed = await db
        .insert(notificationDeliveryTable)
        .values({
          id: uuidv7(),
          ...key,
          status: "claimed",
          attempts: 1,
          claimedAt: at.epochMilliseconds,
          finishedAt: null,
        })
        .onConflictDoUpdate({
          target: [
            notificationDeliveryTable.accountId,
            notificationDeliveryTable.subject,
            notificationDeliveryTable.ref,
            notificationDeliveryTable.channel,
          ],
          set: { attempts: sql`${notificationDeliveryTable.attempts} + 1` },
          setWhere: eq(notificationDeliveryTable.status, "claimed"),
        })
        .returning({ id: notificationDeliveryTable.id });

      return claimed.length === 1;
    },

    async finish(key, status, at) {
      await db
        .update(notificationDeliveryTable)
        .set({ status, finishedAt: at.epochMilliseconds })
        .where(and(isFor(key), eq(notificationDeliveryTable.status, "claimed")));
    },

    async forget(before) {
      await db
        .delete(notificationDeliveryTable)
        .where(lt(notificationDeliveryTable.claimedAt, before.epochMilliseconds));
    },
  };
}

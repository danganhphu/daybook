import { and, eq, lte, ne } from "drizzle-orm";

import type {
  AccessEventWrites,
  AccountWrites,
  CeremonyWrites,
  PasskeyWrites,
  SessionWrites,
  SetupLinkWrites,
} from "@/features/access/application/access-writes";
import type { Batch } from "@/shared/infrastructure/d1/batch";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toAccessEventRow } from "./access-event-mapping";
import { accessEventTable } from "./access-event.table";
import { toAccountRow } from "./account-mapping";
import { accountTable } from "./account.table";
import { toCeremonyRow } from "./ceremony-mapping";
import { ceremonyTable } from "./ceremony.table";
import { toPasskeyRow } from "./passkey-mapping";
import { passkeyTable } from "./passkey.table";
import { toSessionRow } from "./session-mapping";
import { sessionTable } from "./session.table";
import { toSetupLinkRow } from "./setup-link-mapping";
import { setupLinkTable } from "./setup-link.table";

export function createAccountWrites(db: Database, batch: Batch): AccountWrites {
  return {
    add(account) {
      batch.enlist(db.insert(accountTable).values(toAccountRow(account)));
    },
  };
}

export function createPasskeyWrites(db: Database, batch: Batch): PasskeyWrites {
  return {
    add(passkey) {
      batch.enlist(db.insert(passkeyTable).values(toPasskeyRow(passkey)));
    },

    recordUse(passkey) {
      batch.enlist(
        db
          .update(passkeyTable)
          .set({
            signCount: passkey.signCount,
            backedUp: passkey.backedUp ? 1 : 0,
            lastUsedAt: passkey.lastUsedAt?.epochMilliseconds ?? null,
          })
          .where(eq(passkeyTable.id, passkey.id)),
      );
    },
  };
}

export function createSessionWrites(db: Database, batch: Batch): SessionWrites {
  return {
    add(session) {
      batch.enlist(db.insert(sessionTable).values(toSessionRow(session)));
    },

    markSeen(session) {
      batch.enlist(
        db
          .update(sessionTable)
          .set({ lastSeenAt: session.lastSeenAt.epochMilliseconds })
          .where(eq(sessionTable.id, session.id)),
      );
    },

    remove(id) {
      batch.enlist(db.delete(sessionTable).where(eq(sessionTable.id, id)));
    },

    removeAll(accountId) {
      batch.enlist(db.delete(sessionTable).where(eq(sessionTable.accountId, accountId)));
    },

    removeAllExcept(accountId, keep) {
      batch.enlist(
        db
          .delete(sessionTable)
          .where(and(eq(sessionTable.accountId, accountId), ne(sessionTable.id, keep))),
      );
    },
  };
}

export function createSetupLinkWrites(db: Database, batch: Batch): SetupLinkWrites {
  return {
    add(link) {
      batch.enlist(db.insert(setupLinkTable).values(toSetupLinkRow(link)));
    },

    markRedeemed(link) {
      batch.enlist(
        db
          .update(setupLinkTable)
          .set({ redeemedAt: link.redeemedAt.epochMilliseconds })
          .where(eq(setupLinkTable.id, link.id)),
      );
    },
  };
}

export function createCeremonyWrites(db: Database, batch: Batch): CeremonyWrites {
  return {
    add(ceremony) {
      batch.enlist(db.insert(ceremonyTable).values(toCeremonyRow(ceremony)));
    },

    setChallenge(id, challenge) {
      batch.enlist(db.update(ceremonyTable).set({ challenge }).where(eq(ceremonyTable.id, id)));
    },

    remove(id) {
      batch.enlist(db.delete(ceremonyTable).where(eq(ceremonyTable.id, id)));
    },

    removeExpired(now) {
      batch.enlist(
        db.delete(ceremonyTable).where(lte(ceremonyTable.expiresAt, now.epochMilliseconds)),
      );
    },
  };
}

export function createAccessEventWrites(db: Database, batch: Batch): AccessEventWrites {
  return {
    add(event) {
      batch.enlist(db.insert(accessEventTable).values(toAccessEventRow(event)));
    },
  };
}

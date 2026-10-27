import { asc, eq } from "drizzle-orm";

import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toPasskey } from "./passkey-mapping";
import { passkeyTable } from "./passkey.table";

export function createPasskeyRepository(db: Database): PasskeyRepository {
  return {
    async findByCredentialId(credentialId) {
      const [row] = await db
        .select()
        .from(passkeyTable)
        .where(eq(passkeyTable.credentialId, credentialId))
        .limit(1);

      return row === undefined ? undefined : toPasskey(row);
    },

    async listForAccount(accountId) {
      const rows = await db
        .select()
        .from(passkeyTable)
        .where(eq(passkeyTable.accountId, accountId))
        .orderBy(asc(passkeyTable.createdAt), asc(passkeyTable.id));

      return rows.map(toPasskey);
    },

    async list() {
      const rows = await db
        .select()
        .from(passkeyTable)
        .orderBy(asc(passkeyTable.createdAt), asc(passkeyTable.id));

      return rows.map(toPasskey);
    },
  };
}

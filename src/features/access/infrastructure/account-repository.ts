import { asc, eq } from "drizzle-orm";

import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toAccount } from "./account-mapping";
import { accountTable } from "./account.table";

export function createAccountRepository(db: Database): AccountRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(accountTable).where(eq(accountTable.id, id)).limit(1);

      return row === undefined ? undefined : toAccount(row);
    },

    async findByUsername(username) {
      const [row] = await db
        .select()
        .from(accountTable)
        .where(eq(accountTable.username, username))
        .limit(1);

      return row === undefined ? undefined : toAccount(row);
    },

    async list() {
      const rows = await db
        .select()
        .from(accountTable)
        .orderBy(asc(accountTable.createdAt), asc(accountTable.id));

      return rows.map(toAccount);
    },
  };
}

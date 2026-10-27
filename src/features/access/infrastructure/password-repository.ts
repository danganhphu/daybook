import { eq } from "drizzle-orm";

import type { PasswordRepository } from "@/features/access/domain/password-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toAccount } from "./account-mapping";
import { accountTable } from "./account.table";
import { toPassword } from "./password-mapping";
import { passwordTable } from "./password.table";

export function createPasswordRepository(db: Database): PasswordRepository {
  return {
    async get(accountId) {
      const [row] = await db
        .select()
        .from(passwordTable)
        .where(eq(passwordTable.accountId, accountId))
        .limit(1);

      return row === undefined ? undefined : toPassword(row);
    },

    async list() {
      const rows = await db.select().from(passwordTable);

      return rows.map(toPassword);
    },

    async findForUsername(username) {
      const [row] = await db
        .select()
        .from(accountTable)
        .leftJoin(passwordTable, eq(passwordTable.accountId, accountTable.id))
        .where(eq(accountTable.username, username))
        .limit(1);

      return row === undefined
        ? undefined
        : {
            account: toAccount(row.account),
            password: row.password === null ? undefined : toPassword(row.password),
          };
    },
  };
}

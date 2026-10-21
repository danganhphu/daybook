import { eq } from "drizzle-orm";

import type { SetupLinkRepository } from "@/features/access/domain/setup-link-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toSetupLink } from "./setup-link-mapping";
import { setupLinkTable } from "./setup-link.table";

export function createSetupLinkRepository(db: Database): SetupLinkRepository {
  return {
    async findByTokenHash(tokenHash) {
      const [row] = await db
        .select()
        .from(setupLinkTable)
        .where(eq(setupLinkTable.tokenHash, tokenHash))
        .limit(1);

      return row === undefined ? undefined : toSetupLink(row);
    },
  };
}

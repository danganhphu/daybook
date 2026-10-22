import { and, eq } from "drizzle-orm";

import type { CeremonyRepository } from "@/features/access/domain/ceremony-repository";
import type { Database } from "@/shared/infrastructure/d1/database";

import { toCeremony } from "./ceremony-mapping";
import { ceremonyTable } from "./ceremony.table";

export function createCeremonyRepository(db: Database): CeremonyRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(ceremonyTable).where(eq(ceremonyTable.id, id)).limit(1);

      return row === undefined ? undefined : toCeremony(row);
    },

    // One statement, so D1 settles a race: the second caller finds the challenge already gone and changes nothing
    async spendChallenge(id, challenge) {
      const spent = await db
        .update(ceremonyTable)
        .set({ challenge: null })
        .where(and(eq(ceremonyTable.id, id), eq(ceremonyTable.challenge, challenge)))
        .returning({ id: ceremonyTable.id });

      return spent.length === 1;
    },
  };
}

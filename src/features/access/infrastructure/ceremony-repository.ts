import { eq } from "drizzle-orm";

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
  };
}

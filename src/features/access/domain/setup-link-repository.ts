import type { SecretHash } from "./secret";
import type { SetupLink, SetupLinkId } from "./setup-link";

// Reads only. Writes go through the application's unit of work.
export type SetupLinkRepository = {
  get(id: SetupLinkId): Promise<SetupLink | undefined>;
  findByTokenHash(tokenHash: SecretHash): Promise<SetupLink | undefined>;
};

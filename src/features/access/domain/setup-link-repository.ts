import type { SecretHash } from "./secret";
import type { SetupLink } from "./setup-link";

// Reads only. Writes go through the application's unit of work.
export type SetupLinkRepository = {
  findByTokenHash(tokenHash: SecretHash): Promise<SetupLink | undefined>;
};

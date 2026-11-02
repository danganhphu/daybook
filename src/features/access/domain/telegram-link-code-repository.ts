import type { SecretHash } from "./secret";
import type { TelegramLinkCode } from "./telegram-link-code";

export type TelegramLinkCodeRepository = {
  // Deletes the code and returns it, in one statement: of two messages carrying it at once, one gets it
  take(codeHash: SecretHash): Promise<TelegramLinkCode | undefined>;
};

import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import { telegramLinkCodeLifetime } from "./access-policy";
import type { SecretHash } from "./secret";

// Read as a module: `import * as TelegramLinkCodes`

export const telegramLinkCodeIdSchema = z.uuid().brand<"TelegramLinkCodeId">();

export type TelegramLinkCodeId = z.infer<typeof telegramLinkCodeIdSchema>;

// The one-time code a t.me link carries to the bot, kept only as its hash. Spent by being deleted.
export type TelegramLinkCode = {
  readonly id: TelegramLinkCodeId;
  readonly accountId: AccountId;
  readonly codeHash: SecretHash;
  readonly createdAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
};

export function issue(
  accountId: AccountId,
  codeHash: SecretHash,
  now: Temporal.Instant,
): TelegramLinkCode {
  return {
    id: telegramLinkCodeIdSchema.parse(uuidv7()),
    accountId,
    codeHash,
    createdAt: now,
    expiresAt: now.add(telegramLinkCodeLifetime),
  };
}

export function isExpired(code: TelegramLinkCode, now: Temporal.Instant): boolean {
  return Temporal.Instant.compare(now, code.expiresAt) >= 0;
}

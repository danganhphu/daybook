import { env } from "cloudflare:workers";

import { createUnitOfWork } from "@/composition/unit-of-work";
import { enlistNewSession } from "@/features/access/application/enlist-new-session";
import { issueSetupLink } from "@/features/access/application/issue-setup-link";
import { newRandomValue } from "@/features/access/application/secret-tokens";
import { ipAddressSchema, type RequestOrigin } from "@/features/access/domain/access-event";
import * as Accounts from "@/features/access/domain/account";
import {
  displayNameSchema,
  userHandleSchema,
  usernameSchema,
  type Account,
} from "@/features/access/domain/account";
import { deviceLabelSchema, type SessionId } from "@/features/access/domain/session";
import type { SetupLinkGrant } from "@/features/access/domain/setup-link";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import type { Clock } from "@/shared/application/clock";
import { createDatabase } from "@/shared/infrastructure/d1/database";

export function origin(ip = "203.0.113.7", device = "Chrome trên Android"): RequestOrigin {
  return { ip: ipAddressSchema.parse(ip), deviceLabel: deviceLabelSchema.parse(device) };
}

// An account stored straight through the unit of work, as the operator's command or an invite would leave it
export async function seedAccount(clock: Clock, username = "lan", name = "Lan"): Promise<Account> {
  const account = Accounts.create(
    {
      username: usernameSchema.parse(username),
      displayName: displayNameSchema.parse(name),
      userHandle: userHandleSchema.parse(newRandomValue(webCryptoSecrets)),
    },
    clock(),
  );
  const work = createUnitOfWork(createDatabase(env.DB));
  work.accounts.add(account);
  await work.commit();

  return account;
}

// A session as a sign-in would open it, through the same code the sign-in use cases call
export async function seedSession(
  clock: Clock,
  account: Account,
  options: { readonly replacing?: SessionId; readonly from?: RequestOrigin } = {},
) {
  const work = createUnitOfWork(createDatabase(env.DB));
  const opened = await enlistNewSession(
    work,
    webCryptoSecrets,
    {
      accountId: account.id,
      method: "password",
      passkeyId: undefined,
      origin: options.from ?? origin(),
      replacing: options.replacing,
    },
    clock(),
  );
  await work.commit();

  return opened;
}

// A setup link as the operator's command or Settings would issue it
export function seedSetupLink(clock: Clock, grant: SetupLinkGrant) {
  return issueSetupLink(
    {
      clock,
      secrets: webCryptoSecrets,
      startUnitOfWork: () => createUnitOfWork(createDatabase(env.DB)),
    },
    grant,
    origin(),
  );
}

export async function rows<T>(sql: string, ...values: ReadonlyArray<unknown>): Promise<T[]> {
  const result = await env.DB.prepare(sql)
    .bind(...values)
    .all<T>();

  return result.results;
}

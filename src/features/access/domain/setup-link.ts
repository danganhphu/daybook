import { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";

import { setupLinkLifetime } from "./access-policy";
import type { SecretHash } from "./secret";

// Read as a module: `import * as SetupLinks` then `SetupLinks.issue(...)`

export const setupLinkIdSchema = z.uuid().brand<"SetupLinkId">();

export type SetupLinkId = z.infer<typeof setupLinkIdSchema>;

export const setupLinkPurposes = ["first_setup", "invite", "recovery"] as const;

export type SetupLinkPurpose = (typeof setupLinkPurposes)[number];

// What a link is for decides what it carries: an invite has no account until it is redeemed, and only the
// operator's command issues a first-setup link, so it has no author
export type SetupLinkGrant =
  | { readonly purpose: "first_setup"; readonly accountId: AccountId }
  | { readonly purpose: "invite"; readonly createdBy: AccountId }
  | { readonly purpose: "recovery"; readonly accountId: AccountId; readonly createdBy?: AccountId };

type SetupLinkFields = {
  readonly id: SetupLinkId;
  readonly purpose: SetupLinkPurpose;
  readonly accountId: AccountId | undefined;
  readonly createdBy: AccountId | undefined;
  readonly tokenHash: SecretHash;
  readonly createdAt: Temporal.Instant;
  readonly expiresAt: Temporal.Instant;
};

export type PendingSetupLink = SetupLinkFields & { readonly status: "pending" };

export type RedeemedSetupLink = SetupLinkFields & {
  readonly status: "redeemed";
  readonly redeemedAt: Temporal.Instant;
};

export type SetupLink = PendingSetupLink | RedeemedSetupLink;

export function issue(
  grant: SetupLinkGrant & { readonly tokenHash: SecretHash },
  now: Temporal.Instant,
): PendingSetupLink {
  return {
    status: "pending",
    id: setupLinkIdSchema.parse(uuidv7()),
    purpose: grant.purpose,
    accountId: "accountId" in grant ? grant.accountId : undefined,
    createdBy: "createdBy" in grant ? grant.createdBy : undefined,
    tokenHash: grant.tokenHash,
    createdAt: now,
    expiresAt: now.add(setupLinkLifetime),
  };
}

// Used, expired and unknown all answer the same, so a link reveals nothing about why it stopped working
export function redeem(
  link: SetupLink,
  now: Temporal.Instant,
): Result<RedeemedSetupLink, "setup_link_unusable"> {
  if (link.status === "redeemed" || Temporal.Instant.compare(now, link.expiresAt) >= 0) {
    return err("setup_link_unusable");
  }

  return ok({ ...link, status: "redeemed", redeemedAt: now });
}

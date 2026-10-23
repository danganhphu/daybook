import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { AccountId } from "./account-id";

// Read as a module: `import * as Audits` then `Audits.change(record.audit, by, now)`

// How many times a record has been saved. Each change adds exactly one; the screen sends back the version it showed,
// so a change made from a stale screen is refused instead of overwriting someone else's (optimistic concurrency).
export const versionSchema = z.number().int().min(1).brand<"Version">();

export type Version = z.infer<typeof versionSchema>;

// Who made a record and when, who changed it last and when, and its version. What changed is not kept here; records
// that need that (orders, payments) keep a change log of their own.
export type Audit = {
  readonly createdAt: Temporal.Instant;
  readonly createdBy: AccountId;
  // Equal to the creation until the first change, so "recently changed" needs no special case for new records
  readonly updatedAt: Temporal.Instant;
  readonly updatedBy: AccountId;
  readonly version: Version;
};

// A soft delete: who and when. The record stays, so it can be restored and its history read.
export type Deletion = {
  readonly deletedAt: Temporal.Instant;
  readonly deletedBy: AccountId;
};

// Put away rather than deleted: gone from lists and pickers, still shown wherever it was used, such as on old orders
export type Archival = {
  readonly archivedAt: Temporal.Instant;
  readonly archivedBy: AccountId;
};

const firstVersion = versionSchema.parse(1);

export function start(by: AccountId, at: Temporal.Instant): Audit {
  return { createdAt: at, createdBy: by, updatedAt: at, updatedBy: by, version: firstVersion };
}

export function change(audit: Audit, by: AccountId, at: Temporal.Instant): Audit {
  return {
    ...audit,
    updatedAt: at,
    updatedBy: by,
    version: versionSchema.parse(audit.version + 1),
  };
}

export function deletion(by: AccountId, at: Temporal.Instant): Deletion {
  return { deletedAt: at, deletedBy: by };
}

export function archival(by: AccountId, at: Temporal.Instant): Archival {
  return { archivedAt: at, archivedBy: by };
}

// The screen's version is the stored one: nobody has changed the record since it was shown
export function isCurrent(audit: Audit, shown: Version): boolean {
  return audit.version === shown;
}

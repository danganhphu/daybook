import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import {
  defaultQuietAfterDays,
  parseQuietAfterDays,
  type QuietAfterDays,
} from "@/features/reports/domain/gone-quiet";
import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Audit, Version } from "@/shared/domain/audit";
import { checkedSchema } from "@/shared/domain/checked-schema";

// Read as a module: `import * as BookSettings`

export const quietAfterDaysSchema = checkedSchema(z.unknown(), parseQuietAfterDays);

// What the book is set to. Both people share it: a change by one is a change for the other.
export type BookSetting = {
  readonly quietAfterDays: QuietAfterDays;
  // Undefined until someone first changes it: until then it is the defaults, and nothing is stored
  readonly audit: Audit | undefined;
};

export function defaults(): BookSetting {
  return { quietAfterDays: quietAfterDaysSchema.parse(defaultQuietAfterDays), audit: undefined };
}

export function changeQuietAfterDays(
  setting: BookSetting,
  days: QuietAfterDays,
  by: AccountId,
  at: Temporal.Instant,
): BookSetting {
  return {
    ...setting,
    quietAfterDays: days,
    audit:
      setting.audit === undefined ? Audits.start(by, at) : Audits.change(setting.audit, by, at),
  };
}

// The screen showed what is stored now: the defaults when nothing is, or the same version
export function isCurrent(setting: BookSetting, shown: Version | undefined): boolean {
  return setting.audit === undefined
    ? shown === undefined
    : shown !== undefined && Audits.isCurrent(setting.audit, shown);
}

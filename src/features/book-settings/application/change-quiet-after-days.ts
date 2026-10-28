import * as BookSettings from "@/features/book-settings/domain/book-setting";
import type { BookSetting } from "@/features/book-settings/domain/book-setting";
import type { BookSettingRepository } from "@/features/book-settings/domain/book-setting-repository";
import type { QuietAfterDays } from "@/features/reports/domain/gone-quiet";
import type { Clock } from "@/shared/application/clock";
import { commitUnlessStale } from "@/shared/application/stale-write";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import type { AccountId } from "@/shared/domain/account-id";
import type { Version } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { BookSettingError } from "./book-setting-errors";
import type { BookSettingWrites } from "./book-setting-writes";

export type ChangeQuietAfterDaysDeps = {
  readonly clock: Clock;
  readonly settings: BookSettingRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly bookSettings: BookSettingWrites }>;
};

export type ChangeQuietAfterDaysInput = {
  readonly by: AccountId;
  readonly days: QuietAfterDays;
  // The version the screen showed; undefined when it showed the defaults
  readonly shown: Version | undefined;
};

// For the whole book: the reports and the notifications that name quiet customers follow it from then on
export async function changeQuietAfterDays(
  deps: ChangeQuietAfterDaysDeps,
  input: ChangeQuietAfterDaysInput,
): Promise<Result<BookSetting, Extract<BookSettingError, "setting_changed_elsewhere">>> {
  const current = await deps.settings.get();
  if (!BookSettings.isCurrent(current, input.shown)) {
    return err("setting_changed_elsewhere");
  }

  const changed = BookSettings.changeQuietAfterDays(current, input.days, input.by, deps.clock());
  const work = deps.startUnitOfWork();
  if (current.audit === undefined) {
    work.bookSettings.add(changed);
  } else {
    work.bookSettings.update(changed);
  }

  return (await commitUnlessStale(work)) === "stale"
    ? err("setting_changed_elsewhere")
    : ok(changed);
}

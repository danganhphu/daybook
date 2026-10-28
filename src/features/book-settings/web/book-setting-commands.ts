import type { App } from "@/composition/create-app";
import { parseQuietAfterDays } from "@/features/reports/domain/gone-quiet";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";

import type { BookSettingView } from "./book-setting-view";
import { bookSettingErrorMessages } from "./book-settings-copy";

// What Settings > Khách lâu không đặt does for each request, minus the framework. A refusal is the sentence to show.

export async function bookSettingView(app: App): Promise<BookSettingView> {
  const setting = await app.bookSetting();

  return { quietAfterDays: setting.quietAfterDays, version: setting.audit?.version };
}

// The field's digits as a number, spaces around them allowed; anything else is left for the rule to refuse
function typedNumber(text: unknown): unknown {
  return typeof text === "string" && /^\s*\d+\s*$/.test(text) ? Number(text) : text;
}

export async function saveQuietAfterDays(
  app: App,
  by: AccountId,
  days: unknown,
  version: unknown,
): Promise<Result<null, string>> {
  const parsed = parseQuietAfterDays(typedNumber(days));
  if (!parsed.ok) {
    return err(parsed.error);
  }
  // The screen sends back the version it was given; anything else cannot be what it showed
  const shown = versionSchema.nullable().safeParse(version);
  if (!shown.success) {
    return err(bookSettingErrorMessages.setting_changed_elsewhere);
  }
  const changed = await app.changeQuietAfterDays({
    by,
    days: parsed.value,
    shown: shown.data ?? undefined,
  });

  return changed.ok ? ok(null) : err(bookSettingErrorMessages[changed.error]);
}

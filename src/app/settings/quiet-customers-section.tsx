"use client";

import { useCallback } from "react";

import type { SettingsResult } from "@/features/access/web/settings-commands";
import type { BookSettingView } from "@/features/book-settings/web/book-setting-view";
import { bookSettingsCopy } from "@/features/book-settings/web/book-settings-copy";
import { dayCount } from "@/features/reports/web/reports-copy";
import { err } from "@/shared/domain/result";
import { List } from "@/shared/ui/list/list";
import { Screen } from "@/shared/ui/screen/screen";
import { attempt } from "@/shared/web/attempt";

import { saveQuietAfterDays } from "./book-setting-actions";
import { EditableRow } from "./editable-row";
import { settingsCopy } from "./settings-copy";

const daysField = { inputMode: "numeric" } as const;

// How long without an order before a customer counts as gone quiet, for the whole book
export function QuietCustomersSection({
  view,
  back,
}: {
  readonly view: BookSettingView;
  readonly back: string;
}) {
  const { version } = view;
  // The row shows a refusal's sentence; its code matters only to step-up, which this setting does not ask for
  const save = useCallback(
    async (value: string): Promise<SettingsResult<null>> => {
      const saved = await attempt(() => saveQuietAfterDays(value, version ?? null));
      return saved.ok ? saved : err({ code: "invalid", message: saved.error });
    },
    [version],
  );

  return (
    <Screen title={settingsCopy.quiet} back={back}>
      <List footer={bookSettingsCopy.quietUse}>
        <EditableRow
          label={bookSettingsCopy.quietAfterDays}
          value={String(view.quietAfterDays)}
          display={dayCount(view.quietAfterDays)}
          description={bookSettingsCopy.quietRange}
          field={daysField}
          save={save}
          saved={bookSettingsCopy.quietSaved}
        />
      </List>
    </Screen>
  );
}

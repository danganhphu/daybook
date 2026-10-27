"use client";

import { useCallback } from "react";

import { usernameRule } from "@/features/access/domain/account-limits";
import { accessCopy } from "@/features/access/web/access-copy";
import type { AccountView } from "@/features/access/web/account-view";
import { List } from "@/shared/ui/list/list";
import { Screen } from "@/shared/ui/screen/screen";

import { renameAccount, renameUsername } from "./actions";
import { EditableRow } from "./editable-row";
import { settingsCopy } from "./settings-copy";
import { useAccountStepUp } from "./use-step-up";

const usernameField = {
  autoComplete: "username",
  autoCapitalize: "none",
  spellCheck: false,
} as const;
const nameField = { autoComplete: "name" } as const;

export function AccountSection({
  view,
  back,
}: {
  readonly view: AccountView;
  readonly back: string;
}) {
  const stepUp = useAccountStepUp(view);
  const { run } = stepUp;
  const saveDisplayName = useCallback((value: string) => run(() => renameAccount(value)), [run]);
  const saveUsername = useCallback((value: string) => run(() => renameUsername(value)), [run]);

  return (
    <Screen title={settingsCopy.account} back={back}>
      <List>
        <EditableRow
          label={accessCopy.displayName}
          value={view.displayName}
          field={nameField}
          save={saveDisplayName}
          saved={`Đã ${accessCopy.changeDisplayName.toLocaleLowerCase("vi")}`}
        />
        <EditableRow
          label={accessCopy.username}
          value={view.username}
          description={usernameRule}
          field={usernameField}
          save={saveUsername}
          saved={`Đã ${accessCopy.changeUsername.toLocaleLowerCase("vi")}`}
        />
      </List>
      {stepUp.dialog}
    </Screen>
  );
}

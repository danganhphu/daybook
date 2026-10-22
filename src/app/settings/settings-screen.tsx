"use client";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo } from "react";

import { usernameRule } from "@/features/access/domain/account";
import { accessCopy } from "@/features/access/web/access-copy";
import type { AccountView } from "@/features/access/web/account-view";
import { actionLabels } from "@/shared/ui/action-labels";
import { IconButton } from "@/shared/ui/button/icon-button";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListRow } from "@/shared/ui/list/list-row";
import { routes } from "@/shared/web/routes";

import { renameAccount, renameUsername } from "./actions";
import { Devices } from "./devices";
import { EditableRow } from "./editable-row";
import { People } from "./people";
import { SignInMethods } from "./sign-in-methods";
import { useStepUp } from "./use-step-up";

import styles from "./settings.module.scss";

const backLink = <Link href={routes.today} />;

const usernameField = {
  autoComplete: "username",
  autoCapitalize: "none",
  spellCheck: false,
} as const;
const nameField = { autoComplete: "name" } as const;

// The account, its ways in, its devices and what happened lately, as one column of grouped cards. Security settings
// ask to confirm again when the sign-in is old; the server decides when.
export function SettingsScreen({ view }: { readonly view: AccountView }) {
  const signOutForm = useId();
  const stepUpAccount = useMemo(
    () => ({ username: view.username, hasPasskey: view.passkeys.length > 0 }),
    [view.username, view.passkeys.length],
  );
  const stepUp = useStepUp(stepUpAccount);
  const { run } = stepUp;

  const saveDisplayName = useCallback((value: string) => run(() => renameAccount(value)), [run]);
  const saveUsername = useCallback((value: string) => run(() => renameUsername(value)), [run]);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <IconButton
          icon={ArrowLeft}
          label={actionLabels.back}
          render={backLink}
          nativeButton={false}
        />
        <h1 className={styles.title}>{accessCopy.settings}</h1>
      </header>

      <List heading="Tài khoản">
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

      <SignInMethods view={view} run={run} />

      <Devices devices={view.devices} run={run} />

      <People people={view.people} run={run} />

      <List heading="Hoạt động gần đây">
        {view.activity.map((event) => (
          <ListRow key={event.id} title={event.title} detail={event.detail} />
        ))}
      </List>

      <List>
        <ListAction
          label={accessCopy.signOut}
          icon={LogOut}
          tone="danger"
          type="submit"
          form={signOutForm}
        />
      </List>
      {/* A plain POST, so the response can tell the browser to drop the cookies */}
      <form id={signOutForm} method="post" action={routes.signOut} hidden />

      {stepUp.dialog}
    </main>
  );
}

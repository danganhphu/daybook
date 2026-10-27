"use client";

import { useId } from "react";

import { backupPasswordTerm, passkeyTerm } from "@/features/access/application/access-terms";
import { accessCopy } from "@/features/access/web/access-copy";
import type { AccountView } from "@/features/access/web/account-view";
import type { KindView } from "@/features/customers/web/customer-view";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import {
  DevicesIcon,
  GroupIcon,
  HistoryIcon,
  KeyIcon,
  LabelIcon,
  LogoutIcon,
  PersonIcon,
  RestoreFromTrashIcon,
} from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListAction } from "@/shared/ui/list/list-action";
import { ListLink } from "@/shared/ui/list/list-link";
import { Screen } from "@/shared/ui/screen/screen";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";
import { routes, settingsPath } from "@/shared/web/routes";
import { sentenceCase } from "@/shared/web/sentence-case";

import { settingsCopy } from "./settings-copy";

// What the person can sign in with, as the row under "Cách đăng nhập" says it
function waysIn(view: AccountView): string {
  const ways = [
    view.passkeys.length > 0 ? passkeyTerm : undefined,
    view.password.kind === "set" ? backupPasswordTerm : undefined,
  ].filter((way) => way !== undefined);

  return ways.length === 0 ? "Chưa có" : sentenceCase(ways.join(", "));
}

// The overview: a few groups of rows, each opening a screen of its own named as the row is, with what it holds now
// underneath. Sign-out sits apart at the foot.
export function SettingsScreen({
  view,
  kinds,
  from,
}: {
  readonly view: AccountView;
  readonly kinds: ReadonlyArray<KindView>;
  // The tab they were opened from, where the back arrow returns; each section carries it on
  readonly from: string;
}) {
  const signOutForm = useId();

  return (
    <Screen title={accessCopy.settings} back={from}>
      <List heading={settingsCopy.groups.account}>
        <ListLink
          href={settingsPath(from, routes.settingsAccount)}
          title={settingsCopy.account}
          detail={`${view.displayName}, ${view.username}`}
          icon={PersonIcon}
          iconTone={iconTones.customer}
        />
      </List>

      <List heading={settingsCopy.groups.signIn}>
        <ListLink
          href={settingsPath(from, routes.settingsSignIn)}
          title={settingsCopy.signInMethods}
          detail={waysIn(view)}
          icon={KeyIcon}
        />
        <ListLink
          href={settingsPath(from, routes.settingsDevices)}
          title={settingsCopy.devices}
          detail={`${view.devices.length} thiết bị`}
          icon={DevicesIcon}
        />
        <ListLink
          href={settingsPath(from, routes.settingsActivity)}
          title={settingsCopy.activity}
          icon={HistoryIcon}
        />
      </List>

      <List heading={settingsCopy.groups.book}>
        <ListLink
          href={settingsPath(from, routes.settingsPeople)}
          title={settingsCopy.people}
          detail={`${view.people.length} người`}
          icon={GroupIcon}
          iconTone={iconTones.customer}
        />
        <ListLink
          href={settingsPath(from, routes.settingsKinds)}
          title={settingsCopy.kinds}
          detail={`${kinds.filter((kind) => !kind.hidden).length} loại`}
          icon={LabelIcon}
          iconTone={iconTones.item}
        />
        <ListLink
          href={routes.deleted}
          title={settingsCopy.deleted}
          detail={recentlyDeletedCopy.window}
          icon={RestoreFromTrashIcon}
          iconTone={iconTones.danger}
        />
      </List>

      <List>
        <ListAction
          label={accessCopy.signOut}
          icon={LogoutIcon}
          tone="danger"
          type="submit"
          form={signOutForm}
        />
      </List>
      {/* A plain POST, so the response can tell the browser to drop the cookies */}
      <form id={signOutForm} method="post" action={routes.signOut} hidden />
    </Screen>
  );
}

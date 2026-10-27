import { knownTab } from "@/app/(app)/_shell/sections";
import type { App } from "@/composition/create-app";
import type { Session } from "@/features/access/domain/session";
import { toAccountView, type AccountView } from "@/features/access/web/account-view";
import { settingsFromParameter } from "@/shared/web/routes";

export type SettingsPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

// The tab Settings was opened from; anything else in the address means Today
export async function openedFrom({ searchParams }: SettingsPageProps): Promise<string> {
  const from = (await searchParams)[settingsFromParameter];

  return knownTab(typeof from === "string" ? from : undefined);
}

// What the account's sections show, read the same way for each
export async function accountView(app: App, session: Session): Promise<AccountView> {
  return toAccountView(await app.accountOverview(session.accountId), session.id);
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { settingsCopy, telegramLinkedSince } from "@/app/settings/settings-copy";
import { accountView, openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { TelegramSection, type TelegramLinkedView } from "@/app/settings/telegram-section";
import { daybook, telegramAvailable } from "@/composition/daybook";
import { telegramLinkCodeLifetime } from "@/features/access/domain/access-policy";
import type { TelegramLink } from "@/features/access/domain/telegram-link";
import { requireSession } from "@/features/access/web/session-gate";
import { settingsPath } from "@/shared/web/routes";
import { momentText } from "@/shared/web/time-text";

export const metadata: Metadata = { title: settingsCopy.telegram };

export const dynamic = "force-dynamic";

function linkedView(link: TelegramLink | undefined): TelegramLinkedView | undefined {
  return link === undefined
    ? undefined
    : { name: link.telegramName, since: telegramLinkedSince(momentText(link.linkedAt)) };
}

// Only where a bot is configured
export default async function TelegramSettingsPage(props: SettingsPageProps) {
  if (!telegramAvailable()) {
    notFound();
  }
  const app = daybook();
  const session = await requireSession(app);
  const [view, link, from] = await Promise.all([
    accountView(app, session),
    app.telegramLink(session.accountId),
    openedFrom(props),
  ]);

  return (
    <TelegramSection
      view={view}
      linked={linkedView(link)}
      linkMinutes={telegramLinkCodeLifetime.total("minutes")}
      back={settingsPath(from)}
    />
  );
}

"use server";

import { refresh } from "next/cache";

import { daybook, telegramAvailable, telegramBotUsername } from "@/composition/daybook";
import { accessErrorMessages } from "@/features/access/application/access-errors";
import { requestOrigin } from "@/features/access/web/request-context";
import { requireSession } from "@/features/access/web/session-gate";
import * as Settings from "@/features/access/web/settings-commands";
import type { SettingsResult } from "@/features/access/web/settings-commands";
import { err } from "@/shared/domain/result";

import { settingsCopy } from "./settings-copy";

// Settings > Telegram. Both are security settings: the use cases check step-up whatever the page asked before.

// The link comes back once, for the page to show; the page refreshes itself when she returns from Telegram
export async function connectTelegram(): Promise<SettingsResult<Settings.TelegramStartView>> {
  const app = daybook();
  const session = await requireSession(app);
  if (!telegramAvailable()) {
    return err({ code: "not_found", message: accessErrorMessages.not_found });
  }
  const username = await telegramBotUsername();
  if (username === undefined) {
    return err({ code: "fault", message: settingsCopy.telegramUnreachable });
  }

  return Settings.connectTelegram(app, session, username);
}

export async function disconnectTelegram(): Promise<SettingsResult<null>> {
  const app = daybook();
  const session = await requireSession(app);
  const result = await Settings.disconnectTelegram(app, session, await requestOrigin());
  if (result.ok) {
    refresh();
  }

  return result;
}

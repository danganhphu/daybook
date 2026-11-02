import type { TelegramLinkRepository } from "@/features/access/domain/telegram-link-repository";
import type {
  ChannelOutcome,
  NotificationChannel,
} from "@/features/notifications/application/notification-channel";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import type { NotificationPreferenceRepository } from "@/features/notifications/domain/notification-preference-repository";
import type { Clock } from "@/shared/application/clock";
import { vietnamDate } from "@/shared/domain/vietnam-day";

import { cardParams } from "./bot";
import type { BotApi } from "./bot-api";
import { notificationCard } from "./telegram-text";

export type TelegramChannelDeps = {
  readonly clock: Clock;
  readonly api: BotApi;
  readonly appOrigin: URL;
  readonly telegramLinks: TelegramLinkRepository;
  readonly preferences: NotificationPreferenceRepository;
};

// The bot as one of the notifications' channels (ADR 0015): the person's linked chat, unless they turned it off. A
// Telegram message has no tag to replace an earlier one, so the ledger's claim is what keeps a retry from sending twice.
export function createTelegramChannel(deps: TelegramChannelDeps): NotificationChannel {
  return {
    name: "telegram",

    async send(accountId, content, ref): Promise<ChannelOutcome> {
      const [link, preference] = await Promise.all([
        deps.telegramLinks.get(accountId),
        deps.preferences.get(accountId),
      ]);
      const wanted = (preference ?? NotificationPreferences.defaults(accountId)).telegram;
      if (link === undefined || !wanted) {
        return { kind: "unreachable" };
      }

      const card = notificationCard(content, ref, {
        appOrigin: deps.appOrigin,
        today: vietnamDate(deps.clock()),
      });
      const sent = await deps.api.sendMessage({ chat_id: link.chatId, ...cardParams(card) });
      if (sent.ok) {
        return { kind: "sent" };
      }

      switch (sent.error.kind) {
        case "retry":
          return { kind: "retry", afterSeconds: sent.error.afterSeconds };
        case "blocked":
        case "refused":
          return { kind: "unreachable" };
        default:
          return sent.error satisfies never;
      }
    },
  };
}

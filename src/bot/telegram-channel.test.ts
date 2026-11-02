import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createUnitOfWork } from "@/composition/unit-of-work";
import { createTelegramLinkRepository } from "@/features/access/infrastructure/telegram-link-repository";
import type { MorningContent } from "@/features/notifications/application/notification-content";
import * as NotificationPreferences from "@/features/notifications/domain/notification-preference";
import { createNotificationPreferenceRepository } from "@/features/notifications/infrastructure/notification-preference-repository";
import { reminderIdSchema } from "@/features/reminders/domain/reminder";
import { versionSchema } from "@/shared/domain/audit";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { content, relyingParty, testClock, theAuthor } from "@/testing/support/app";
import { lanOnTelegram, recordingBotApi, seedTelegramLink } from "@/testing/support/telegram";

import { createTelegramChannel } from "./telegram-channel";

const now = "2026-11-02T00:30:00Z";
const reminderId = reminderIdSchema.parse("019a3f2e-7c1b-7d4e-9f00-123456789abd");

const morning: MorningContent = {
  kind: "morning",
  day: Temporal.PlainDate.from("2026-11-02"),
  due: [
    {
      reminderId,
      version: versionSchema.parse(3),
      text: content("gọi lại <Hoa Mai>"),
      dueOn: Temporal.PlainDate.from("2026-10-31"),
      customerName: undefined,
    },
  ],
  quiet: ["Minh Châu"],
};

function channel() {
  const time = testClock(now);
  const telegram = recordingBotApi();
  const db = createDatabase(env.DB);

  return {
    time,
    telegram,
    channel: createTelegramChannel({
      clock: time.clock,
      api: telegram.api,
      appOrigin: new URL(relyingParty.origin),
      telegramLinks: createTelegramLinkRepository(db),
      preferences: createNotificationPreferenceRepository(db),
    }),
  };
}

describe("the Telegram channel", () => {
  it("given her Telegram linked, when the morning list goes, then it reaches her chat with a Xong for each reminder", async () => {
    const tested = channel();
    await seedTelegramLink(tested.time.clock, await theAuthor(), lanOnTelegram);

    expect(await tested.channel.send(await theAuthor(), morning, "2026-11-02")).toEqual({
      kind: "sent",
    });
    expect(tested.telegram.calls).toEqual([
      {
        method: "sendMessage",
        params: {
          chat_id: lanOnTelegram.id,
          text: "<b>Hôm nay có 1 việc</b>\n1. gọi lại &lt;Hoa Mai&gt; (quá hạn 2 ngày)\n\nLâu không đặt: Minh Châu",
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [
              [{ text: "Xong 1", callback_data: `cr:${reminderId}:3` }],
              [{ text: "Mở", url: "https://daybook.example.workers.dev/reminders" }],
            ],
          },
        },
      },
    ]);
  });

  it("given no Telegram linked, when a notification goes, then this channel cannot reach her", async () => {
    const tested = channel();

    expect(await tested.channel.send(await theAuthor(), morning, "2026-11-02")).toEqual({
      kind: "unreachable",
    });
    expect(tested.telegram.calls).toEqual([]);
  });

  it("given she turned Gửi qua Telegram off, when a notification goes, then nothing is sent", async () => {
    const tested = channel();
    const author = await theAuthor();
    await seedTelegramLink(tested.time.clock, author, lanOnTelegram);
    const work = createUnitOfWork(createDatabase(env.DB));
    work.notificationPreferences.add(
      NotificationPreferences.changeTelegram(
        NotificationPreferences.defaults(author),
        false,
        author,
        tested.time.clock(),
      ),
    );
    await work.commit();

    expect(await tested.channel.send(author, morning, "2026-11-02")).toEqual({
      kind: "unreachable",
    });
    expect(tested.telegram.calls).toEqual([]);
  });

  it("given Telegram busy, when a notification goes, then it is retried after Telegram's wait", async () => {
    const tested = channel();
    await seedTelegramLink(tested.time.clock, await theAuthor(), lanOnTelegram);
    tested.telegram.failWith({ kind: "retry", afterSeconds: 3 });

    expect(await tested.channel.send(await theAuthor(), morning, "2026-11-02")).toEqual({
      kind: "retry",
      afterSeconds: 3,
    });
  });
});

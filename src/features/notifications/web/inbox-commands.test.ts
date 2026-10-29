import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createUnitOfWork } from "@/composition/unit-of-work";
import type { Account } from "@/features/access/domain/account";
import * as InboxItems from "@/features/notifications/domain/inbox-item";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";

import { inboxView, markRead, unreadNotifications } from "./inbox-commands";

async function told(account: Account, title: string, at: string) {
  const work = createUnitOfWork(createDatabase(env.DB));
  work.inbox.add(
    InboxItems.create(
      { accountId: account.id, subject: "morning", ref: at, title, body: "", path: "/reminders" },
      Temporal.Instant.from(at),
    ),
  );
  await work.commit();
}

// 15:00 in Vietnam on Thursday 29 October 2026
async function lanAtThree() {
  const time = testClock("2026-10-29T08:00:00Z");
  const lan = await seedAccount(time.clock, "lan", "Lan");
  const { session } = await seedSession(time.clock, lan);

  return { time, lan, session, app: testApp(time.clock) };
}

describe("the notifications screen", () => {
  it("given notifications today, yesterday and before, when shown, then each says when as a person would", async () => {
    const { lan, session, app } = await lanAtThree();
    await told(lan, "Hôm nay", "2026-10-29T07:15:00Z");
    await told(lan, "Hôm qua", "2026-10-28T10:00:00Z");
    await told(lan, "Tuần trước", "2026-10-20T00:30:00Z");
    await told(lan, "Năm ngoái", "2025-12-31T00:30:00Z");

    const view = await inboxView(app, session);

    expect(view.rows.map((row) => [row.title, row.when, row.unread])).toEqual([
      ["Hôm nay", "14:15", true],
      ["Hôm qua", "Hôm qua", true],
      ["Tuần trước", "20/10", true],
      ["Năm ngoái", "31/12/2025", true],
    ]);
    expect(view.footer).toBe("Thông báo được giữ 30 ngày.");
    expect(view.readUpTo).toBe(Temporal.Instant.from("2026-10-29T07:15:00Z").epochMilliseconds);
  });

  it("given everything read, when shown, then there is nothing to mark", async () => {
    const { lan, session, app } = await lanAtThree();
    await told(lan, "Hôm nay", "2026-10-29T07:15:00Z");
    await markRead(app, session, Temporal.Instant.from("2026-10-29T07:15:00Z").epochMilliseconds);

    const view = await inboxView(app, session);

    expect([view.rows[0]?.unread, view.readUpTo]).toEqual([false, undefined]);
    expect(await unreadNotifications(app, session)).toBe(0);
  });

  it.each([undefined, "soon", -1, 1.5])(
    "given %s instead of a time, when marked read, then nothing changes",
    async (upTo) => {
      const { lan, session, app } = await lanAtThree();
      await told(lan, "Hôm nay", "2026-10-29T07:15:00Z");

      await markRead(app, session, upTo);

      expect(await unreadNotifications(app, session)).toBe(1);
    },
  );
});

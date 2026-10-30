import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createUnitOfWork } from "@/composition/unit-of-work";
import type { Account } from "@/features/access/domain/account";
import * as InboxItems from "@/features/notifications/domain/inbox-item";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { recordingPushSender, testJobs } from "@/testing/support/notifications";

async function told(account: Account, title: string, at: string, ref = at) {
  const work = createUnitOfWork(createDatabase(env.DB));
  work.inbox.add(
    InboxItems.create(
      { accountId: account.id, subject: "notice", ref, title, body: "", path: "/settings" },
      Temporal.Instant.from(at),
    ),
  );
  await work.commit();
}

describe("the list behind the bell", () => {
  it("given notifications for her and for the other person, when she opens the list, then she sees hers, newest first, unread", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const { session } = await seedSession(time.clock, lan);
    await told(lan, "Có thêm một thiết bị nhận thông báo", "2026-10-29T07:15:00Z");
    await told(lan, "Hôm nay có 2 việc", "2026-10-29T00:30:00Z");
    await told(minh, "Vừa đổi tên đăng nhập", "2026-10-29T07:30:00Z");
    const app = testApp(time.clock);

    const items = await app.notificationInbox(session);

    expect(items.map((item) => [item.title, InboxItems.isUnread(item)])).toEqual([
      ["Có thêm một thiết bị nhận thông báo", true],
      ["Hôm nay có 2 việc", true],
    ]);
    expect(await app.unreadNotifications(session)).toBe(2);
  });

  it("given the list seen up to its newest item, when marked read, then those are read and one made after stays unread", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const { session } = await seedSession(time.clock, lan);
    await told(lan, "Hôm nay có 2 việc", "2026-10-29T00:30:00Z");
    const app = testApp(time.clock);
    const [shown] = await app.notificationInbox(session);
    await told(lan, "Có thêm một thiết bị nhận thông báo", "2026-10-29T07:59:00Z");

    await app.markInboxRead(session, shown?.createdAt ?? time.clock());

    expect(
      (await app.notificationInbox(session)).map((item) => [item.title, InboxItems.isUnread(item)]),
    ).toEqual([
      ["Có thêm một thiết bị nhận thông báo", true],
      ["Hôm nay có 2 việc", false],
    ]);
    expect(await app.unreadNotifications(session)).toBe(1);
  });

  it("given the other person's list, when she marks hers read, then theirs stays unread", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const lanSession = (await seedSession(time.clock, lan)).session;
    const minhSession = (await seedSession(time.clock, minh)).session;
    await told(minh, "Vừa đổi tên đăng nhập", "2026-10-29T07:30:00Z");
    const app = testApp(time.clock);

    await app.markInboxRead(lanSession, time.clock());

    expect(await app.unreadNotifications(minhSession)).toBe(1);
  });

  it("given her notifications and the other person's, when she deletes some, then hers go and an id of theirs she sends changes nothing", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const lanSession = (await seedSession(time.clock, lan)).session;
    const minhSession = (await seedSession(time.clock, minh)).session;
    await told(lan, "Hôm nay có 2 việc", "2026-10-29T00:30:00Z");
    await told(lan, "Có thêm một thiết bị nhận thông báo", "2026-10-29T07:15:00Z");
    await told(minh, "Vừa đổi tên đăng nhập", "2026-10-29T07:30:00Z");
    const app = testApp(time.clock);
    const [newest] = await app.notificationInbox(lanSession);
    const [theirs] = await app.notificationInbox(minhSession);
    if (newest === undefined || theirs === undefined) {
      throw new Error("A notification is missing");
    }

    await app.deleteInboxItems(lanSession, [newest.id, theirs.id]);

    expect((await app.notificationInbox(lanSession)).map((item) => item.title)).toEqual([
      "Hôm nay có 2 việc",
    ]);
    expect(await app.notificationInbox(minhSession)).toHaveLength(1);

    await app.clearInbox(lanSession);
    expect(await app.notificationInbox(lanSession)).toEqual([]);
    expect(await app.notificationInbox(minhSession)).toHaveLength(1);
  });

  it("given notifications older than 30 days and newer, when the midnight run comes, then only the old ones are gone", async () => {
    const time = testClock("2026-10-28T17:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const { session } = await seedSession(time.clock, lan);
    await told(lan, "Cũ", "2026-09-27T00:30:00Z");
    await told(lan, "Còn giữ", "2026-09-30T00:30:00Z");

    // Midnight in Vietnam, the slot the ledger is cleaned in
    await testJobs(time.clock, recordingPushSender().sender).scheduleSlot(
      Temporal.Instant.from("2026-10-28T17:00:00Z"),
    );

    expect(
      (await testApp(time.clock).notificationInbox(session)).map((item) => item.title),
    ).toEqual(["Còn giữ"]);
  });
});

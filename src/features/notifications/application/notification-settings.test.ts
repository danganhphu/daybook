import { describe, expect, it } from "vitest";

import { pushEndpointSchema } from "@/features/notifications/domain/push-subscription";
import { parseTimeOfDay, type TimeOfDay } from "@/features/notifications/domain/time-of-day";
import { origin, rows, seedAccount, seedSession } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";
import { browserSubscription } from "@/testing/support/notifications";

function timeOf(text: string): TimeOfDay {
  const parsed = parseTimeOfDay(text);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

async function events(kind: string) {
  return rows<{ account_id: string; session_id: string }>(
    "select account_id, session_id from access_event where kind = ?",
    kind,
  );
}

describe("subscribeDevice", () => {
  it("given a signed-in browser, when it turns notifications on, then it receives under this session and it is recorded once", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const app = testApp(time.clock);

    expect(await app.subscribeDevice(phone.session, browserSubscription("a"), origin())).toEqual({
      ok: true,
      value: null,
    });

    const settings = await app.notificationSettings(phone.session);
    expect(settings.devices.map((device) => device.current)).toEqual([true]);
    expect(await events("push_subscribed")).toEqual([
      { account_id: lan.id, session_id: phone.session.id },
    ]);
  });

  it("given a browser that was on, when it signs in again, then it sleeps until handed over, then moves to the new session without a second record", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const before = await seedSession(time.clock, lan);
    const app = testApp(time.clock);
    const subscription = browserSubscription("a");
    await app.subscribeDevice(before.session, subscription, origin());

    const after = await seedSession(time.clock, lan, { replacing: before.session.id });
    expect(await rows("select session_id from push_subscription")).toEqual([{ session_id: null }]);
    await app.subscribeDevice(after.session, subscription, origin());

    expect(await rows("select session_id from push_subscription")).toEqual([
      { session_id: after.session.id },
    ]);
    expect(await events("push_subscribed")).toHaveLength(1);
  });

  it("given a session whose browser renewed its address, when the new one is handed over, then the old one is replaced, not kept beside it", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const app = testApp(time.clock);
    await app.subscribeDevice(phone.session, browserSubscription("old"), origin());

    await app.subscribeDevice(phone.session, browserSubscription("new"), origin());

    expect(await rows<{ endpoint: string }>("select endpoint from push_subscription")).toEqual([
      { endpoint: "https://fcm.googleapis.com/fcm/send/new" },
    ]);
    expect(await events("push_subscribed")).toHaveLength(1);
  });

  it("given an address that is not a push service's, when handed over, then it is refused and nothing is stored", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const crafted = {
      ...browserSubscription(),
      endpoint: pushEndpointSchema.parse("https://attacker.example/fcm/send/a"),
    };

    const answer = await testApp(time.clock).subscribeDevice(phone.session, crafted, origin());

    expect(answer).toEqual({ ok: false, error: "push_service_unknown" });
    expect(await rows("select id from push_subscription")).toHaveLength(0);
  });

  it("given a browser on, when its session is signed out, then it receives nothing: its subscription is left with no session", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const app = testApp(time.clock);
    await app.subscribeDevice(phone.session, browserSubscription(), origin());

    await app.signOut(phone.session, origin());

    expect(await rows("select session_id from push_subscription")).toEqual([{ session_id: null }]);
  });

  it("given a device whose sign-in ran out, when the settings are read, then it is not shown as receiving", async () => {
    const time = testClock("2026-10-01T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const old = await seedSession(time.clock, lan);
    const app = testApp(time.clock);
    await app.subscribeDevice(old.session, browserSubscription("old"), origin());
    time.setTo("2026-10-28T01:00:00Z");
    const now = await seedSession(time.clock, lan);

    const settings = await app.notificationSettings(now.session);

    expect(settings.devices).toEqual([]);
  });
});

describe("unsubscribeDevice", () => {
  it("given the other person's device, when asked to remove it, then it is not found and stays", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    const minh = await seedAccount(time.clock, "minh", "Minh");
    const lanPhone = await seedSession(time.clock, lan);
    const minhPhone = await seedSession(time.clock, minh);
    const app = testApp(time.clock);
    await app.subscribeDevice(minhPhone.session, browserSubscription(), origin());
    const [minhDevice] = (await app.notificationSettings(minhPhone.session)).devices;

    expect(
      await app.unsubscribeDevice(lanPhone.session, minhDevice?.subscription.id, origin()),
    ).toEqual({ ok: false, error: "not_found" });
    expect(await rows("select id from push_subscription")).toHaveLength(1);
  });

  it("given one of my devices, when removed, then it receives nothing more and it is recorded", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const app = testApp(time.clock);
    await app.subscribeDevice(phone.session, browserSubscription(), origin());
    const [device] = (await app.notificationSettings(phone.session)).devices;

    expect(await app.unsubscribeDevice(phone.session, device?.subscription.id, origin())).toEqual({
      ok: true,
      value: null,
    });
    expect(await rows("select id from push_subscription")).toHaveLength(0);
    expect(await events("push_unsubscribed")).toHaveLength(1);
  });
});

describe("changeNotificationTimes", () => {
  it("given the defaults on screen, when a time is changed, then it is saved; the same old screen again is refused", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const app = testApp(time.clock);

    const first = await app.changeNotificationTimes(phone.session, {
      times: { morningAt: timeOf("06:45"), weeklyAt: undefined },
      shown: undefined,
    });
    const stale = await app.changeNotificationTimes(phone.session, {
      times: { morningAt: timeOf("08:00"), weeklyAt: undefined },
      shown: undefined,
    });

    expect(first).toMatchObject({ ok: true, value: { morningAt: "06:45", weeklyAt: undefined } });
    expect(stale).toEqual({ ok: false, error: "times_changed_elsewhere" });
    expect((await app.notificationSettings(phone.session)).preference.morningAt).toBe("06:45");
  });

  it("given saved times, when changed from the screen that showed them, then the version moves on", async () => {
    const time = testClock("2026-10-28T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const phone = await seedSession(time.clock, lan);
    const app = testApp(time.clock);
    const first = await app.changeNotificationTimes(phone.session, {
      times: { morningAt: timeOf("06:45"), weeklyAt: timeOf("17:00") },
      shown: undefined,
    });
    if (!first.ok) {
      throw new Error(first.error);
    }

    const second = await app.changeNotificationTimes(phone.session, {
      times: { morningAt: undefined, weeklyAt: timeOf("16:30") },
      shown: first.value.audit?.version,
    });

    expect(second).toMatchObject({ ok: true, value: { morningAt: undefined, weeklyAt: "16:30" } });
    expect(second.ok && second.value.audit?.version).toBe(2);
  });
});

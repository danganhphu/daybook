import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Guards what the notifications migration adds by hand - STRICT - and the checks that keep the rules in the database
// as well as in code. The audited table's triggers are checked with every other audited table.

const accountId = "019a0000-0000-7000-8000-000000000001";
const hash = "S".repeat(43);
const p256dh = `B${"A".repeat(86)}`;
const auth = "C".repeat(22);

function run(sql: string, ...values: ReadonlyArray<unknown>) {
  return env.DB.prepare(sql)
    .bind(...values)
    .run();
}

async function seedAccountAndSession() {
  await run(
    "insert into account (id, username, display_name, webauthn_user_handle, created_at, updated_at) values (?, 'lan', 'Lan', ?, 1, 1)",
    accountId,
    "H".repeat(43),
  );
  await run(
    "insert into session (id, account_id, verifier, method, passkey_id, authenticated_at, expires_at, last_seen_at, device_label) values ('s1', ?, ?, 'password', null, 1, 2, 1, 'Chrome')",
    accountId,
    hash,
  );
}

function insertSubscription(
  endpoint: string,
  keys: { p256dh: string; auth: string } = { p256dh, auth },
) {
  return run(
    "insert into push_subscription values ('p1', ?, 's1', ?, ?, ?, 'Chrome', 1, null)",
    accountId,
    endpoint,
    keys.p256dh,
    keys.auth,
  );
}

function insertDelivery(id: string, status: string, finishedAt: unknown) {
  return run(
    "insert into notification_delivery values (?, ?, 'morning', '2026-10-29', 'push', ?, 1, 1, ?)",
    id,
    accountId,
    status,
    finishedAt,
  );
}

describe("STRICT on every notifications table", () => {
  it.each([
    ["notice_cursor", "insert into notice_cursor values ('access_notices', 'soon', 'e')"],
    [
      "notification_delivery",
      "insert into notification_delivery values ('d', 'a', 'morning', 'r', 'push', 'claimed', 'once', 1, null)",
    ],
    [
      "notification_preference",
      "insert into notification_preference values ('a', null, null, 'soon', 'a', 1, 'a', 1)",
    ],
    [
      "push_subscription",
      `insert into push_subscription values ('p', 'a', null, 'https://x', '${p256dh}', '${auth}', 'x', 'soon', null)`,
    ],
  ])(
    "given text in an integer column of %s, when inserted, then STRICT refuses it",
    async (_, sql) => {
      await expect(run(sql)).rejects.toThrow(/cannot store TEXT value in INTEGER column/);
    },
  );
});

describe("push_subscription table", () => {
  it("given an address that is not https, when stored, then the check refuses it", async () => {
    await seedAccountAndSession();

    await expect(insertSubscription("http://fcm.googleapis.com/x")).rejects.toThrow(
      /push_subscription_endpoint_https/,
    );
  });

  it("given keys of the wrong length, when stored, then the check refuses them", async () => {
    await seedAccountAndSession();

    await expect(
      insertSubscription("https://fcm.googleapis.com/x", { p256dh: "short", auth }),
    ).rejects.toThrow(/push_subscription_key_lengths/);
  });

  it("given a subscription, when its session is deleted, then it stays, with no session", async () => {
    await seedAccountAndSession();
    await insertSubscription("https://fcm.googleapis.com/x");

    await run("delete from session where id = 's1'");

    expect(
      (await env.DB.prepare("select session_id from push_subscription").all()).results,
    ).toEqual([{ session_id: null }]);
  });
});

describe("notification_preference table", () => {
  it.each(["07:10", "24:00", "7:30"])(
    "given the time %s, when stored, then the quarter-hour check refuses it",
    async (morningAt) => {
      await seedAccountAndSession();

      await expect(
        run(
          "insert into notification_preference values (?, ?, null, 1, ?, 1, ?, 1)",
          accountId,
          morningAt,
          accountId,
          accountId,
        ),
      ).rejects.toThrow(/notification_preference_morning_quarter_hour/);
    },
  );
});

describe("notification_delivery table", () => {
  it("given a delivery already in the ledger, when the same one is inserted again, then the unique index refuses it", async () => {
    await seedAccountAndSession();
    await insertDelivery("d1", "claimed", null);

    await expect(insertDelivery("d2", "claimed", null)).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it.each([
    ["claimed", 5],
    ["sent", null],
  ])(
    "given status %s with finished_at %j, when stored, then the check refuses it",
    async (status, finishedAt) => {
      await seedAccountAndSession();

      await expect(insertDelivery("d1", status, finishedAt)).rejects.toThrow(
        /notification_delivery_finished_when_not_claimed/,
      );
    },
  );
});

describe("notice_cursor table", () => {
  it("given a second cursor, when stored, then the check refuses it", async () => {
    await expect(run("insert into notice_cursor values ('other', 1, 'e')")).rejects.toThrow(
      /notice_cursor_single/,
    );
  });
});

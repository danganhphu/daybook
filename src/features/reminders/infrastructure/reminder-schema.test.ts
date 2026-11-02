import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { changeOf, content, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

// Guards the hand-written parts of the reminders migrations that the use cases never exercise

describe("reminder table", () => {
  it("given a reminder deleted before its customer, when a write brings it back while the customer is deleted, then the trigger refuses", async () => {
    const app = testApp(testClock("2026-10-23T01:00:00Z").clock);
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const reminder = expectOk(
      await app.addReminder({
        by,
        details: {
          text: content("Gọi lại"),
          dueOn: Temporal.PlainDate.from("2026-10-24"),
          customerId: customer.id,
        },
        fromNote: undefined,
      }),
    );
    expectOk(await app.deleteReminder(changeOf(reminder, by)));
    expectOk(await app.deleteCustomer(changeOf(customer, by)));

    await expect(
      env.DB.prepare(
        "update reminder set deleted_at = null, deleted_by = null, version = version + 1 where id = ?",
      )
        .bind(reminder.id)
        .run(),
    ).rejects.toThrow(/stale_version/);
  });
});

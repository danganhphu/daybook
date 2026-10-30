import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { testApp, testClock } from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";

// Guards the hand-written parts of the trash migration that the use cases never exercise: the CHECKs added with the
// columns, which a hand-written update could otherwise slip past

function anApp() {
  return testApp(testClock("2026-10-26T02:00:00Z").clock);
}

describe("customer table", () => {
  it("given a customer in use, when marked deleted without being hidden, then the check refuses", async () => {
    const lan = await aCustomer(anApp(), "Lan");

    await expect(
      env.DB.prepare(
        "update customer set deleted_at = 2, deleted_by = created_by, version = version + 1 where id = ?",
      )
        .bind(lan.id)
        .run(),
    ).rejects.toThrow(/customer_deleted_only_archived/);
  });

  it("given a hidden customer, when marked deleted with no one doing it, then the check refuses", async () => {
    const lan = await aCustomer(anApp(), "Lan");

    await expect(
      env.DB.prepare(
        "update customer set archived_at = 2, archived_by = created_by, deleted_at = 2, version = version + 1 where id = ?",
      )
        .bind(lan.id)
        .run(),
    ).rejects.toThrow(/customer_deletion_whole/);
  });
});

describe("sales_order table", () => {
  it("given a live order, when it names a customer it was deleted with, then the check refuses", async () => {
    const app = anApp();
    const lan = await aCustomer(app, "Lan");
    const order = await anOrder(app, lan, [line("Kim", 1, 100_000)]);

    await expect(
      env.DB.prepare(
        "update sales_order set deleted_with = customer_id, version = version + 1 where id = ?",
      )
        .bind(order.id)
        .run(),
    ).rejects.toThrow(/sales_order_deleted_with_only_deleted/);
  });
});

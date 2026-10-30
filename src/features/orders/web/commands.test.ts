import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { changeOf, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

import { deletedOrders, productOrders } from "./commands";

describe("deletedOrders", () => {
  it("given orders deleted now and a month ago, when the recently deleted list is read, then only the recent one is there, with what it was", async () => {
    const time = testClock("2026-09-20T03:00:00Z");
    const app = testApp(time.clock);
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const old = await anOrder(app, customer, [line("Kim", 1, 10_000)], "2026-09-20");
    expectOk(await app.deleteOrder(changeOf(old, by)));
    time.setTo("2026-10-23T03:00:00Z");
    const recent = await anOrder(app, customer, [line("Bông gòn", 2, 20_000)], "2026-10-22");
    expectOk(await app.deleteOrder(changeOf(recent, by)));

    const rows = await deletedOrders(app, await app.displayNames());

    expect(rows).toEqual([
      {
        id: recent.id,
        version: 2,
        title: "Hướng Dương",
        detail: "Đơn 22/10, 40.000đ, Xoá 23/10 (Người ghi)",
        deletedAt: Temporal.Instant.from("2026-10-23T03:00:00Z").epochMilliseconds,
      },
    ]);
  });
});

describe("productOrders", () => {
  it("given orders that sold a product and one that did not, when its page lists them, then only theirs are there, newest first", async () => {
    const app = testApp(testClock("2026-10-23T03:00:00Z").clock);
    const customer = await aCustomer(app, "Hướng Dương");
    const older = await anOrder(app, customer, [line("Kim", 1, 10_000)], "2026-10-20");
    const newer = await anOrder(
      app,
      customer,
      [line("Bông gòn", 1, 5_000), line("Kim", 2, 10_000)],
      "2026-10-22",
    );
    await anOrder(app, customer, [line("Bông gòn", 1, 5_000)], "2026-10-21");
    const kim = older.lines[0]?.productId ?? "";

    const rows = await productOrders(app, kim);

    expect(rows.map((row) => [row.id, row.orderedOn])).toEqual([
      [newer.id, "2026-10-22"],
      [older.id, "2026-10-20"],
    ]);
  });
});

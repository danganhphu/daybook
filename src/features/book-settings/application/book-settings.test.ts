import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { quietAfterDaysSchema } from "@/features/book-settings/domain/book-setting";
import { periodContaining } from "@/features/reports/domain/report-period";
import { testApp, testClock, theAuthor, thePartner } from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

const days = (count: number) => quietAfterDaysSchema.parse(count);

// Today is 29 October 2026 in Vietnam
function anApp() {
  return testApp(testClock("2026-10-29T03:00:00Z").clock);
}

describe("the book's settings", () => {
  it("given nothing changed yet, when read, then a customer goes quiet after 21 days and nothing is stored", async () => {
    expect(await anApp().bookSetting()).toEqual({ quietAfterDays: 21, audit: undefined });
  });
});

describe("changeQuietAfterDays", () => {
  it("given the defaults shown, when one person changes the days, then the other reads the new number", async () => {
    const by = await theAuthor();
    expectOk(await anApp().changeQuietAfterDays({ by, days: days(30), shown: undefined }));

    const setting = await anApp().bookSetting();

    expect([setting.quietAfterDays, setting.audit?.version, setting.audit?.updatedBy]).toEqual([
      30,
      1,
      by,
    ]);
  });

  it("given a change already made, when changed again from a screen showing it, then the version moves on", async () => {
    const app = anApp();
    const by = await theAuthor();
    const first = expectOk(
      await app.changeQuietAfterDays({ by, days: days(30), shown: undefined }),
    );

    const second = expectOk(
      await app.changeQuietAfterDays({ by, days: days(14), shown: first.audit?.version }),
    );

    expect([second.quietAfterDays, second.audit?.version]).toEqual([14, 2]);
    expect((await app.bookSetting()).quietAfterDays).toBe(14);
  });

  it("given a screen still showing the defaults after the other person changed them, when it saves, then it is refused and their number stays", async () => {
    const app = anApp();
    expectOk(
      await app.changeQuietAfterDays({ by: await thePartner(), days: days(45), shown: undefined }),
    );

    const refused = await app.changeQuietAfterDays({
      by: await theAuthor(),
      days: days(30),
      shown: undefined,
    });

    expect(refused).toEqual({ ok: false, error: "setting_changed_elsewhere" });
    expect((await app.bookSetting()).quietAfterDays).toBe(45);
  });

  it("given a customer whose last order is 25 days old, when the days go from 21 to 30, then the report stops listing them", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Ánh Dương");
    await anOrder(app, customer, [line("Găng tay", 1, 100_000)], "2026-10-04");
    const october = periodContaining("month", Temporal.PlainDate.from("2026-10-29"));
    const before = (await app.readReport({ period: october })).quiet;

    expectOk(
      await app.changeQuietAfterDays({ by: await theAuthor(), days: days(30), shown: undefined }),
    );
    const after = (await app.readReport({ period: october })).quiet;

    expect(before?.afterDays).toBe(21);
    expect(before?.customers.map((each) => each.customerId)).toEqual([customer.id]);
    expect(after).toEqual({ afterDays: 30, customers: [] });
  });
});

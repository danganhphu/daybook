import { env } from "cloudflare:workers";
import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { createUnitOfWork } from "@/composition/unit-of-work";
import * as AccessEvents from "@/features/access/domain/access-event";
import type { Account } from "@/features/access/domain/account";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { origin, seedAccount } from "@/testing/support/access";
import { testApp, testClock } from "@/testing/support/app";

import { activityLimits } from "./account-overview";

// `count` events a minute apart, the last at `last`
async function recorded(account: Account, count: number, last: string) {
  const work = createUnitOfWork(createDatabase(env.DB));
  const end = Temporal.Instant.from(last);
  for (let index = 0; index < count; index += 1) {
    work.accessEvents.add(
      AccessEvents.record(
        "push_subscribed",
        { accountId: account.id, actorId: account.id },
        origin(),
        end.subtract({ minutes: count - 1 - index }),
      ),
    );
  }
  await work.commit();
}

describe("the sign-in log", () => {
  it("given more than a page in the last 30 days, when read a page at a time, then each page says whether there are more", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    await recorded(lan, activityLimits.page + 5, "2026-10-29T07:00:00Z");
    const app = testApp(time.clock);

    const first = await app.accountOverview(lan.id);
    const both = await app.accountOverview(lan.id, activityLimits.page * 2);

    expect([first.activity.length, first.moreActivity]).toEqual([activityLimits.page, true]);
    expect(both.moreActivity).toBe(false);
    expect(both.activity.length).toBeGreaterThan(activityLimits.page);
  });

  it("given more than a screen ever lists, when read to its end, then no more is offered", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    await recorded(lan, activityLimits.most + 5, "2026-10-29T07:00:00Z");

    const overview = await testApp(time.clock).accountOverview(
      lan.id,
      activityLimits.most + activityLimits.page,
    );

    expect([overview.activity.length, overview.moreActivity]).toEqual([activityLimits.most, false]);
  });

  it("given an event older than 30 days, when read, then it is not in the log", async () => {
    const time = testClock("2026-10-29T08:00:00Z");
    const lan = await seedAccount(time.clock, "lan", "Lan");
    await recorded(lan, 1, "2026-09-28T07:00:00Z");

    const overview = await testApp(time.clock).accountOverview(lan.id);

    expect(overview.activity.some((event) => event.kind === "push_subscribed")).toBe(false);
  });
});

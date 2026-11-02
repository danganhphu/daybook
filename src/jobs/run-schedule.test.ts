import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { slotAt } from "@/features/notifications/domain/slot";

import { runSchedule } from "./run-schedule";

type Jobs = ReturnType<Parameters<typeof runSchedule>[0]>;
type Planned = Awaited<ReturnType<Jobs["scheduleSlot"]>>;
type Emptied = Awaited<ReturnType<Jobs["emptyExpiredTrash"]>>;

function controllerAt(iso: string): ScheduledController {
  return { scheduledTime: Date.parse(iso), cron: "*/15 * * * *", noRetry() {} };
}

// 00:00 and 00:15 in Việt Nam: the first is the day's first quarter hour, when the trash is emptied
const firstQuarter = "2026-10-28T17:00:00Z";
const nextQuarter = "2026-10-28T17:15:00Z";

function quiet(iso: string): Planned {
  return { slot: slotAt(Temporal.Instant.from(iso)), digests: 0, notices: 0 };
}

function scheduled(plan: () => Promise<Planned>, emptied: () => Promise<Emptied> = async () => []) {
  const ran = { trash: 0 };
  const jobs: Jobs = {
    scheduleSlot: plan,
    emptyExpiredTrash: async () => {
      ran.trash += 1;
      return emptied();
    },
  };

  return { ran, jobsOf: () => jobs };
}

// Bindings read wrongly: the jobs are never made
function unmade(): Jobs {
  throw new Error("DB binding missing");
}

describe("runSchedule", () => {
  it("given the day's first quarter hour, when it runs, then the trash is emptied", async () => {
    const { ran, jobsOf } = scheduled(async () => quiet(firstQuarter));

    await runSchedule(jobsOf, controllerAt(firstQuarter));

    expect(ran.trash).toBe(1);
  });

  it("given any other quarter hour, when it runs, then the trash is left alone", async () => {
    const { ran, jobsOf } = scheduled(async () => quiet(nextQuarter));

    await runSchedule(jobsOf, controllerAt(nextQuarter));

    expect(ran.trash).toBe(0);
  });

  it("given the notifications' part fails at the first quarter hour, when it runs, then the trash is still emptied and the fault is passed on", async () => {
    const { ran, jobsOf } = scheduled(async () => {
      throw new Error("D1 unavailable");
    });

    await expect(runSchedule(jobsOf, controllerAt(firstQuarter))).rejects.toThrow("D1 unavailable");
    expect(ran.trash).toBe(1);
  });

  it("given a kind the trash could not empty, when it runs, then the run itself succeeds and that kind waits for the next night", async () => {
    const { jobsOf } = scheduled(
      async () => quiet(firstQuarter),
      async () => [{ kind: "product", error: new Error("FOREIGN KEY constraint failed") }],
    );

    await expect(runSchedule(jobsOf, controllerAt(firstQuarter))).resolves.toBeUndefined();
  });

  it("given the jobs cannot be made, when it runs, then the fault is passed on", async () => {
    await expect(runSchedule(unmade, controllerAt(nextQuarter))).rejects.toThrow(
      "DB binding missing",
    );
  });
});

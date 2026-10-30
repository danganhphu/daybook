import { Temporal } from "temporal-polyfill/implementation";

import type { createJobs } from "@/composition/jobs";
import { timesOfDay } from "@/features/notifications/domain/time-of-day";
import { errorLines } from "@/shared/infrastructure/error-lines";

type Jobs = Pick<ReturnType<typeof createJobs>, "scheduleSlot" | "emptyExpiredTrash">;

// The cron trigger, every quarter hour; once a day, at its first quarter hour, the trash is emptied of what it has kept
// long enough. A line in Workers Logs when it queued something or failed; a quiet slot says nothing.
export async function runSchedule(jobs: Jobs, controller: ScheduledController): Promise<void> {
  try {
    const plan = await jobs.scheduleSlot(
      Temporal.Instant.fromEpochMilliseconds(controller.scheduledTime),
    );
    if (plan.digests + plan.notices > 0) {
      console.log(
        JSON.stringify({
          event: "notifications_queued",
          slot: `${plan.slot.day.toString()} ${plan.slot.time}`,
          digests: plan.digests,
          notices: plan.notices,
        }),
      );
    }
    if (plan.slot.time === timesOfDay[0]) {
      await jobs.emptyExpiredTrash();
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "schedule_failed", errors: errorLines(error) }));
    throw error;
  }
}

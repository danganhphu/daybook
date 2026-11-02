import { Temporal } from "temporal-polyfill/implementation";

import type { createJobs } from "@/composition/jobs";
import { isDailySlot, slotAt } from "@/features/notifications/domain/slot";
import { errorLines } from "@/shared/infrastructure/error-lines";
import { logEvent, logInfo } from "@/shared/infrastructure/log-event";

type Jobs = Pick<ReturnType<typeof createJobs>, "scheduleSlot" | "emptyExpiredTrash">;

const noTrashRun: Awaited<ReturnType<Jobs["emptyExpiredTrash"]>> = [];

// The cron trigger, every quarter hour; once a day, at its first quarter hour, the trash is emptied of what it has kept
// long enough, whether or not the notifications' part went well. A line in Workers Logs when it queued something or
// failed; a quiet slot says nothing. The jobs are made inside, so a binding read wrongly is logged like any failure.
export async function runSchedule(
  jobsOf: () => Jobs,
  controller: ScheduledController,
): Promise<void> {
  const scheduledTime = Temporal.Instant.fromEpochMilliseconds(controller.scheduledTime);
  try {
    const jobs = jobsOf();
    const [planned, emptied] = await Promise.allSettled([
      jobs.scheduleSlot(scheduledTime),
      isDailySlot(slotAt(scheduledTime)) ? jobs.emptyExpiredTrash() : Promise.resolve(noTrashRun),
    ]);
    if (planned.status === "fulfilled" && planned.value.digests + planned.value.notices > 0) {
      const { slot, digests, notices } = planned.value;
      logInfo("notifications_queued", {
        slot: `${slot.day.toString()} ${slot.time}`,
        digests,
        notices,
      });
    }
    for (const { kind, error } of emptied.status === "fulfilled" ? emptied.value : []) {
      logEvent("trash_purge_failed", { kind, errors: errorLines(error) });
    }
    const failed = [planned, emptied].find((outcome) => outcome.status === "rejected");
    if (failed !== undefined) {
      throw failed.reason;
    }
  } catch (error) {
    logEvent("schedule_failed", { errors: errorLines(error) });
    throw error;
  }
}

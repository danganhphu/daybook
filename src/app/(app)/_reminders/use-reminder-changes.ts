import { startTransition, useCallback } from "react";

import {
  completeReminder,
  deleteReminder,
  reopenReminder,
  restoreReminder,
} from "@/app/(app)/reminders/actions";
import type { ReminderChangeResult } from "@/features/reminders/web/commands";
import type { ReminderView } from "@/features/reminders/web/reminder-view";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";

type Change = (id: string, version: number) => Promise<ReminderChangeResult>;

// Done and delete are one tap each, with Undo in the toast. `hide` takes the row away before the server answers.
export function useReminderChanges(hide: (id: string) => void) {
  const toast = useToast();

  const run = useCallback(
    (reminder: ReminderView, change: Change, undo: Change, title: string) => {
      startTransition(async () => {
        hide(reminder.id);
        const result = await attempt(() => change(reminder.id, reminder.version));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }

        const version = result.value;
        toast.show({
          title,
          description: reminder.text,
          action: {
            label: actionLabels.undo,
            onAction: () => {
              startTransition(async () => {
                const undone = await attempt(() => undo(reminder.id, version));
                if (!undone.ok) {
                  toast.show({ title: undone.error });
                }
              });
            },
          },
        });
      });
    },
    [hide, toast],
  );

  const complete = useCallback(
    (reminder: ReminderView) => run(reminder, completeReminder, reopenReminder, remindersCopy.done),
    [run],
  );
  const remove = useCallback(
    (reminder: ReminderView) =>
      run(reminder, deleteReminder, restoreReminder, remindersCopy.deleted),
    [run],
  );

  return { complete, remove };
}

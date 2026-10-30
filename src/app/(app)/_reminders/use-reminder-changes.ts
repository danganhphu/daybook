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
import { useConfirm } from "@/shared/ui/dialog/use-confirm";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { deleteQuestion, recentlyDeletedCopy } from "@/shared/web/recently-deleted";

type Change = (id: string, version: number) => Promise<ReminderChangeResult>;

// Done is one tap; delete asks first. Both have Undo in the toast. `hide` takes the row away before the server
// answers. The screen renders `dialog`, where delete asks.
export function useReminderChanges(hide: (id: string) => void) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

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
    (reminder: ReminderView) => {
      void (async () => {
        const sure = await confirm({
          title: deleteQuestion(remindersCopy.one),
          description: recentlyDeletedCopy.canRestore,
          confirmLabel: actionLabels.remove,
        });
        if (sure) {
          run(reminder, deleteReminder, restoreReminder, remindersCopy.deleted);
        }
      })();
    },
    [confirm, run],
  );

  return { complete, remove, dialog };
}

"use client";

import { startTransition, useCallback, useOptimistic } from "react";

import { completeReminder, reopenReminder } from "@/app/(app)/reminders/actions";
import type { DoneReminderView, DoneRemindersView } from "@/features/reminders/web/reminder-view";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import { CheckCircleIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListRow } from "@/shared/ui/list/list-row";
import { QuietLink } from "@/shared/ui/quiet-link/quiet-link";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";

function without(list: ReadonlyArray<DoneReminderView>, id: string) {
  return list.filter((reminder) => reminder.id !== id);
}

// The finished reminders, latest first, a page at a time. Reopening takes one tap and has an Undo, as finishing does.
export function DoneReminders({ view }: { readonly view: DoneRemindersView }) {
  const toast = useToast();
  const [shown, hide] = useOptimistic(view.reminders, without);

  const reopen = useCallback(
    (reminder: DoneReminderView) => {
      startTransition(async () => {
        hide(reminder.id);
        const result = await attempt(() => reopenReminder(reminder.id, reminder.version));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }

        const version = result.value;
        toast.show({
          title: remindersCopy.reopened,
          description: reminder.text,
          action: {
            label: actionLabels.undo,
            onAction: () => {
              startTransition(async () => {
                const undone = await attempt(() => completeReminder(reminder.id, version));
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

  return (
    <>
      {shown.length === 0 ? (
        <EmptyState title={remindersCopy.noneDone} />
      ) : (
        <List>
          {shown.map((reminder) => (
            <DoneRow key={reminder.id} reminder={reminder} onReopen={reopen} />
          ))}
        </List>
      )}
      {view.nextPath === undefined ? null : (
        <QuietLink href={view.nextPath}>{remindersCopy.more}</QuietLink>
      )}
    </>
  );
}

function DoneRow({
  reminder,
  onReopen,
}: {
  readonly reminder: DoneReminderView;
  readonly onReopen: (reminder: DoneReminderView) => void;
}) {
  const reopen = useCallback(() => onReopen(reminder), [onReopen, reminder]);

  return (
    <ListRow
      title={reminder.text}
      detail={reminder.detail}
      icon={CheckCircleIcon}
      iconTone={iconTones.item}
    >
      <Button variant="quiet" onClick={reopen}>
        {remindersCopy.reopen}
      </Button>
    </ListRow>
  );
}

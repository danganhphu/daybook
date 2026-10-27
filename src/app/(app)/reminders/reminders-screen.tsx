"use client";

import { useCallback, useMemo, useState } from "react";

import { ReminderDialog } from "@/app/(app)/_reminders/reminder-dialog";
import { ReminderList } from "@/app/(app)/_reminders/reminder-list";
import type { RemindersScreenView } from "@/features/reminders/web/commands";
import type { DoneRemindersView } from "@/features/reminders/web/reminder-view";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { doneRemindersPath } from "@/features/reminders/web/reminders-path";
import { Button } from "@/shared/ui/button/button";
import { IconButton } from "@/shared/ui/button/icon-button";
import { ChipLinks, type ChipLink } from "@/shared/ui/chip-links/chip-links";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { AddIcon } from "@/shared/ui/icon/icons";
import { Screen } from "@/shared/ui/screen/screen";
import { routes } from "@/shared/web/routes";

import { DoneReminders } from "./done-reminders";

export type RemindersScreenProps = {
  readonly view: RemindersScreenView;
  // The finished ones, when that view is chosen
  readonly done: DoneRemindersView | undefined;
};

// Every open reminder by when it is due: overdue first, then today, tomorrow and later days. The finished ones are a
// chip away, latest first, each one tap from open again.
export function RemindersScreen({ view, done }: RemindersScreenProps) {
  const [adding, setAdding] = useState(false);
  const add = useCallback(() => setAdding(true), []);
  const close = useCallback(() => setAdding(false), []);
  const addButton = useMemo(
    () => <IconButton icon={AddIcon} label={remindersCopy.add} onClick={add} />,
    [add],
  );
  const addAction = useMemo(
    () => (
      <Button variant="primary" onClick={add}>
        {remindersCopy.add}
      </Button>
    ),
    [add],
  );
  const chips = useMemo<ReadonlyArray<ChipLink>>(
    () => [
      { label: remindersCopy.open, href: routes.reminders, current: done === undefined },
      { label: remindersCopy.done, href: doneRemindersPath(), current: done !== undefined },
    ],
    [done],
  );

  return (
    <Screen title={remindersCopy.title} back={routes.today} actions={addButton}>
      <ChipLinks label={remindersCopy.title} chips={chips} />
      {done !== undefined ? (
        <DoneReminders view={done} />
      ) : view.groups.length === 0 ? (
        <EmptyState
          title={remindersCopy.empty}
          description={remindersCopy.emptyHint}
          action={addAction}
        />
      ) : (
        view.groups.map((group) => (
          <ReminderList
            key={group.label}
            heading={group.label}
            reminders={group.reminders}
            today={view.today}
            showDue={false}
          />
        ))
      )}
      {adding ? <ReminderDialog onClose={close} today={view.today} /> : null}
    </Screen>
  );
}

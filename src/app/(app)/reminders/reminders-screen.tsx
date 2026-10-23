"use client";

import { useCallback, useMemo, useState } from "react";

import { ReminderDialog } from "@/app/(app)/_reminders/reminder-dialog";
import { ReminderList } from "@/app/(app)/_reminders/reminder-list";
import type { RemindersScreenView } from "@/features/reminders/web/commands";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { Button } from "@/shared/ui/button/button";
import { IconButton } from "@/shared/ui/button/icon-button";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { AddIcon } from "@/shared/ui/icon/icons";
import { PageHeader } from "@/shared/ui/page-header/page-header";
import { Screen } from "@/shared/ui/screen/screen";
import { routes } from "@/shared/web/routes";

// Every open reminder by when it is due: overdue first, then today, tomorrow and later days
export function RemindersScreen({ view }: { readonly view: RemindersScreenView }) {
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

  return (
    <Screen>
      <PageHeader title={remindersCopy.title} back={routes.today} actions={addButton} />
      {view.groups.length === 0 ? (
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

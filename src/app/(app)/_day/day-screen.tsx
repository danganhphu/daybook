"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";

import { DueBar } from "@/app/(app)/_reminders/due-bar";
import { ReminderDialog } from "@/app/(app)/_reminders/reminder-dialog";
import { deleteNote, editNote, recordNote, restoreNote } from "@/app/actions";
import { accessCopy } from "@/features/access/web/access-copy";
import { Composer } from "@/features/capture/web/composer";
import type { DayView } from "@/features/notes/web/commands";
import { applyChange, type ShownNote } from "@/features/notes/web/note-list";
import { NoteRow } from "@/features/notes/web/note-row";
import type { NoteView } from "@/features/notes/web/note-view";
import { notesCopy } from "@/features/notes/web/notes-copy";
import type { DueView } from "@/features/reminders/web/reminder-view";
import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { IconButton } from "@/shared/ui/button/icon-button";
import { IconLink } from "@/shared/ui/button/icon-link";
import { DayPicker } from "@/shared/ui/day-picker/day-picker";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LogoutIcon,
  NotificationsIcon,
  SearchIcon,
  SettingsIcon,
} from "@/shared/ui/icon/icons";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { dayPath, routes } from "@/shared/web/routes";

import styles from "./day-screen.module.scss";

export type DayScreenProps = {
  readonly view: DayView;
  // Today's: what is due, shown under the header
  readonly due?: DueView | undefined;
};

// A day as a chat: the notes above, oldest first. Today also has the box at the bottom, where the thumb is; an
// earlier day is read, corrected and tidied, but nothing new is written into it.
export function DayScreen({ view, due }: DayScreenProps) {
  const toast = useToast();
  const [reminding, setReminding] = useState<NoteView>();
  const stopReminding = useCallback(() => setReminding(undefined), []);
  const remindFrom = useMemo(
    () => (reminding === undefined ? undefined : { id: reminding.id, text: reminding.content }),
    [reminding],
  );
  const router = useRouter();
  const titleId = useId();
  const signOutForm = useRef<HTMLFormElement>(null);
  const menuActions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: accessCopy.settings, icon: SettingsIcon, href: routes.settings },
      {
        label: accessCopy.signOut,
        icon: LogoutIcon,
        onSelect: () => signOutForm.current?.requestSubmit(),
      },
    ],
    [],
  );
  const saved = useMemo<ReadonlyArray<ShownNote>>(
    () => view.notes.map((note) => ({ ...note, saving: false })),
    [view.notes],
  );
  const [shown, applyOptimistic] = useOptimistic(saved, applyChange);

  // `deleted` is the note as deleteNote answered, so the undo carries the version the deletion left
  const restore = useCallback(
    (deleted: NoteView) => {
      startTransition(async () => {
        applyOptimistic({ kind: "restore", note: deleted });
        const result = await attempt(() => restoreNote(deleted.id, deleted.version));
        if (!result.ok) {
          toast.show({ title: result.error });
        }
      });
    },
    [applyOptimistic, toast],
  );

  // One tap, no confirmation: the toast's Undo is the safety net
  const remove = useCallback(
    (note: NoteView) => {
      startTransition(async () => {
        applyOptimistic({ kind: "remove", id: note.id });
        const result = await attempt(() => deleteNote(note.id, note.version));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }

        const deleted = result.value;
        toast.show({
          title: notesCopy.deleted,
          description: note.content,
          action: { label: actionLabels.undo, onAction: () => restore(deleted) },
        });
      });
    },
    [applyOptimistic, restore, toast],
  );

  const goTo = useCallback(
    (day: string) => router.push(dayPath(day, view.today)),
    [router, view.today],
  );

  return (
    <div className={styles.screen} data-wash={view.isToday ? "" : undefined}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.heading}>
            <p className={styles.subtitle}>{view.subtitle}</p>
            <h1 id={titleId} className={styles.title}>
              {view.title}
            </h1>
          </div>
          {/* No prefetch here or below: each is a Worker request and D1 reads that most visits never use */}
          <div className={styles.actions}>
            <IconLink
              icon={NotificationsIcon}
              label={remindersCopy.title}
              href={routes.reminders}
              prefetch={false}
            />
            <IconLink
              icon={SearchIcon}
              label={notesCopy.search}
              href={routes.history}
              prefetch={false}
            />
            <ActionMenu label={actionLabels.options} actions={menuActions} />
          </div>
          {/* A plain POST, so the response can tell the browser to drop the cookies */}
          <form ref={signOutForm} method="post" action={routes.signOut} hidden />
        </div>
        <nav className={styles.days} aria-label={notesCopy.otherDays}>
          <IconLink
            icon={ChevronLeftIcon}
            label={`${notesCopy.goToDay} ${view.previous.label}`}
            href={view.previous.path}
            prefetch={false}
          />
          <DayPicker label={notesCopy.pickDay} day={view.day} max={view.today} onPick={goTo} />
          {view.next === undefined ? (
            <IconButton icon={ChevronRightIcon} label={notesCopy.noNextDay} disabled />
          ) : (
            <IconLink
              icon={ChevronRightIcon}
              label={`${notesCopy.goToDay} ${view.next.label}`}
              href={view.next.path}
              prefetch={false}
            />
          )}
        </nav>
        {view.isToday && due !== undefined ? <DueBar due={due} /> : null}
      </header>
      <main className={styles.scroller}>
        <div className={styles.content}>
          {shown.length === 0 ? (
            view.isToday ? (
              <EmptyState title={notesCopy.emptyToday} description={notesCopy.emptyTodayHint} />
            ) : (
              <EmptyState title={notesCopy.emptyDay} />
            )
          ) : (
            <ol className={styles.list} aria-labelledby={titleId}>
              {shown.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  edit={editNote}
                  onPending={applyOptimistic}
                  onDelete={remove}
                  onRemind={setReminding}
                />
              ))}
            </ol>
          )}
        </div>
      </main>
      {view.isToday ? <Composer record={recordNote} onPending={applyOptimistic} /> : null}
      {remindFrom === undefined ? null : (
        <ReminderDialog onClose={stopReminding} today={view.today} fromNote={remindFrom} />
      )}
    </div>
  );
}

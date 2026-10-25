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

import { PickCustomerDialog } from "@/app/(app)/_day/pick-customer-dialog";
import { DueBar } from "@/app/(app)/_reminders/due-bar";
import { ReminderDialog } from "@/app/(app)/_reminders/reminder-dialog";
import { deleteOrder } from "@/app/(app)/orders/actions";
import { deleteReminder } from "@/app/(app)/reminders/actions";
import {
  answerReading,
  deleteNote,
  editNote,
  readNote,
  recordNote,
  restoreNote,
} from "@/app/actions";
import { accessCopy } from "@/features/access/web/access-copy";
import { Composer } from "@/features/capture/web/composer";
import type { DayView } from "@/features/notes/web/commands";
import { applyChange, type ShownNote } from "@/features/notes/web/note-list";
import { NoteRow } from "@/features/notes/web/note-row";
import { preview, type NoteView } from "@/features/notes/web/note-view";
import { notesCopy } from "@/features/notes/web/notes-copy";
import { NoteReading, type ReadingPending } from "@/features/reading/web/note-reading";
import { readingCopy } from "@/features/reading/web/reading-copy";
import type { AnswerView, DayReadings, MadeView } from "@/features/reading/web/reading-view";
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
  // What each note's message became
  readonly readings?: DayReadings | undefined;
};

const nothingPending: ReadonlyMap<string, ReadingPending> = new Map();

function withPending(
  pending: ReadonlyMap<string, ReadingPending>,
  [noteId, what]: readonly [string, ReadingPending],
): ReadonlyMap<string, ReadingPending> {
  return new Map(pending).set(noteId, what);
}

// A day as a chat: the notes above, oldest first. Today also has the box at the bottom, where the thumb is; an
// earlier day is read, corrected and tidied, but nothing new is written into it. Each note is read once saved: what
// its message became shows under it, with Undo in a toast.
export function DayScreen({ view, due, readings }: DayScreenProps) {
  const toast = useToast();
  const canRead = readings?.canRead ?? false;
  const [pending, markPending] = useOptimistic(nothingPending, withPending);
  // The note whose customer is being picked from the list
  const [picking, setPicking] = useState<string>();
  const stopPicking = useCallback(() => setPicking(undefined), []);
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

  const undoMade = useCallback(
    (made: Exclude<MadeView, { kind: "nothing" }>) => {
      startTransition(async () => {
        const result =
          made.kind === "order"
            ? await attempt(() => deleteOrder(made.id, made.version))
            : await attempt(() => deleteReminder(made.id, made.version));
        if (!result.ok) {
          toast.show({ title: result.error });
        }
      });
    },
    [toast],
  );

  // What a reading made shows on its note at once; the toast is the quick way back
  const announce = useCallback(
    (made: MadeView) => {
      if (made.kind === "nothing") {
        return;
      }
      toast.show({
        title: made.kind === "order" ? readingCopy.orderMade : readingCopy.reminderMade,
        action: { label: actionLabels.undo, onAction: () => undoMade(made) },
      });
    },
    [toast, undoMade],
  );

  // Asked for by a tap, so a failure to reach the server is said; after saving it is not, since the note is kept
  const startReading = useCallback(
    (noteId: string, again: boolean, asked: boolean) => {
      startTransition(async () => {
        markPending([noteId, "reading"]);
        const result = await attempt(() => readNote(noteId, again));
        if (result.ok) {
          announce(result.value);
        } else if (asked) {
          toast.show({ title: result.error });
        }
      });
    },
    [announce, markPending, toast],
  );

  const readAgain = useCallback(
    (noteId: string) => startReading(noteId, true, true),
    [startReading],
  );
  const readAction = useMemo(
    () => ({
      label: readingCopy.read,
      onRead: (note: NoteView) => startReading(note.id, false, true),
    }),
    [startReading],
  );

  // Saved first, read after: the box is free again as soon as the note is kept
  const recordAndRead = useCallback(
    async (text: string) => {
      const result = await recordNote(text);
      if (result.ok && canRead) {
        startReading(result.value.id, false, false);
      }
      return result;
    },
    [canRead, startReading],
  );

  const answer = useCallback(
    (noteId: string, given: AnswerView) => {
      startTransition(async () => {
        markPending([noteId, "saving"]);
        const result = await attempt(() => answerReading(noteId, given));
        if (result.ok) {
          announce(result.value);
        } else {
          toast.show({ title: result.error });
        }
      });
    },
    [announce, markPending, toast],
  );

  const pickedFor = picking === undefined ? undefined : shown.find((note) => note.id === picking);
  const pickCustomer = useCallback(
    (customerId: string) => {
      if (picking !== undefined) {
        answer(picking, { kind: "customer", customerId });
      }
    },
    [answer, picking],
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
              {shown.map((note) => {
                const reading = readings?.byNote[note.id];
                return (
                  <NoteRow
                    key={note.id}
                    note={note}
                    edit={editNote}
                    onPending={applyOptimistic}
                    onDelete={remove}
                    onRemind={setReminding}
                    read={
                      canRead && reading?.kind === "unread" && !pending.has(note.id)
                        ? readAction
                        : undefined
                    }
                  >
                    <NoteReading
                      noteId={note.id}
                      view={reading}
                      pending={pending.get(note.id)}
                      onReadAgain={readAgain}
                      onAnswer={answer}
                      onPickCustomer={setPicking}
                    />
                  </NoteRow>
                );
              })}
            </ol>
          )}
        </div>
      </main>
      {view.isToday ? <Composer record={recordAndRead} onPending={applyOptimistic} /> : null}
      {remindFrom === undefined ? null : (
        <ReminderDialog onClose={stopReminding} today={view.today} fromNote={remindFrom} />
      )}
      {pickedFor === undefined ? null : (
        <PickCustomerDialog
          about={preview(pickedFor.content)}
          onPick={pickCustomer}
          onClose={stopPicking}
        />
      )}
    </div>
  );
}

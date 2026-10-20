"use client";

import { startTransition, useCallback, useMemo, useOptimistic } from "react";

import { deleteNote, editNote, recordNote, restoreNote } from "@/app/actions";
import { Composer } from "@/features/capture/web/composer";
import { applyChange, type ShownNote } from "@/features/notes/web/note-list";
import { NoteRow } from "@/features/notes/web/note-row";
import type { NoteView } from "@/features/notes/web/note-view";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { useToast } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";

import styles from "./today-screen.module.scss";

export type TodayScreenProps = {
  // "Thứ Hai, 19/10"
  readonly label: string;
  // Oldest first
  readonly notes: ReadonlyArray<NoteView>;
};

// Today as a chat: her notes above, oldest first, and the box at the bottom where her thumb is
export function TodayScreen({ label, notes }: TodayScreenProps) {
  const toast = useToast();
  const saved = useMemo<ReadonlyArray<ShownNote>>(
    () => notes.map((note) => ({ ...note, saving: false })),
    [notes],
  );
  const [shown, applyOptimistic] = useOptimistic(saved, applyChange);

  const restore = useCallback(
    (note: NoteView) => {
      startTransition(async () => {
        applyOptimistic({ kind: "restore", note });
        const result = await attempt(() => restoreNote(note.id));
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
        const result = await attempt(() => deleteNote(note.id));
        if (!result.ok) {
          toast.show({ title: result.error });
          return;
        }

        toast.show({
          title: "Đã xoá ghi chú",
          description: note.content,
          action: { label: "Hoàn tác", onAction: () => restore(note) },
        });
      });
    },
    [applyOptimistic, restore, toast],
  );

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>Hôm nay</h1>
          <p className={styles.date}>{label}</p>
        </div>
      </header>
      <main className={styles.scroller}>
        <div className={styles.content}>
          {shown.length === 0 ? (
            <EmptyState
              title="Hôm nay chưa có ghi chú nào"
              description="Gõ vào ô bên dưới, ghi chú sẽ hiện ở đây."
            />
          ) : (
            <ol className={styles.list} aria-label="Ghi chú hôm nay">
              {shown.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  edit={editNote}
                  onPending={applyOptimistic}
                  onDelete={remove}
                />
              ))}
            </ol>
          )}
        </div>
      </main>
      <Composer record={recordNote} onPending={applyOptimistic} />
    </div>
  );
}

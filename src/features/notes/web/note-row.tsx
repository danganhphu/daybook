"use client";

import { startTransition, useCallback, useMemo, useState, type ReactNode } from "react";

import { remindersCopy } from "@/features/reminders/web/reminders-copy";
import { actionLabels, optionsFor } from "@/shared/ui/action-labels";
import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { DeleteIcon, EditIcon, NotificationsIcon, ReceiptLongIcon } from "@/shared/ui/icon/icons";
import { attempt } from "@/shared/web/attempt";

import { NoteEditor } from "./note-editor";
import type { NoteListChange, ShownNote } from "./note-list";
import { preview, type NoteResult, type NoteView } from "./note-view";

import styles from "./note-row.module.scss";

export type NoteRowProps = {
  readonly note: ShownNote;
  // The server action that saves an edit
  readonly edit: (id: string, version: number, text: string) => Promise<NoteResult>;
  // Shows a change in the list before the server has answered
  readonly onPending: (change: NoteListChange) => void;
  readonly onDelete: (note: NoteView) => void;
  // Opens the reminder form with the note's words
  readonly onRemind: (note: NoteView) => void;
  // Reads a note never read into an order or a reminder, labelled as given; none where it cannot be read
  readonly read?: { readonly label: string; readonly onRead: (note: NoteView) => void } | undefined;
  // Beneath the words: what the note's message became
  readonly children?: ReactNode;
};

type Editing = { readonly draft: string; readonly error?: string };

export function NoteRow({
  note,
  edit,
  onPending,
  onDelete,
  onRemind,
  read,
  children,
}: NoteRowProps) {
  const [editing, setEditing] = useState<Editing>();

  const startEditing = useCallback(() => setEditing({ draft: note.content }), [note.content]);
  const cancel = useCallback(() => setEditing(undefined), []);

  const save = useCallback(
    (text: string) => {
      setEditing(undefined);
      if (text === note.content) {
        return;
      }

      startTransition(async () => {
        onPending({ kind: "edit", id: note.id, content: text });
        const result = await attempt(() => edit(note.id, note.version, text));
        if (!result.ok) {
          // Reopen with what was written, and why it was not saved
          setEditing({ draft: text, error: result.error });
        }
      });
    },
    [note.id, note.version, note.content, edit, onPending],
  );

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [
      { label: actionLabels.edit, icon: EditIcon, onSelect: startEditing },
      { label: remindersCopy.fromNote, icon: NotificationsIcon, onSelect: () => onRemind(note) },
      ...(read === undefined
        ? []
        : [{ label: read.label, icon: ReceiptLongIcon, onSelect: () => read.onRead(note) }]),
    ],
    [note, onRemind, read, startEditing],
  );

  const destructive = useMemo<MenuAction>(
    () => ({ label: actionLabels.remove, icon: DeleteIcon, onSelect: () => onDelete(note) }),
    [note, onDelete],
  );

  return (
    <li className={editing === undefined ? styles.card : styles.editing} aria-busy={note.saving}>
      {editing === undefined ? (
        <>
          <p className={styles.content}>{note.content}</p>
          {children === undefined ? null : <div className={styles.footer}>{children}</div>}
          <time className={styles.time} dateTime={note.createdAt}>
            {note.time}
          </time>
          {note.saving ? (
            <span className={styles.menuSpace} />
          ) : (
            <ActionMenu
              label={optionsFor(`ghi chú "${preview(note.content)}"`)}
              actions={actions}
              destructive={destructive}
            />
          )}
        </>
      ) : (
        <NoteEditor
          initial={editing.draft}
          initialError={editing.error}
          onSave={save}
          onCancel={cancel}
        />
      )}
    </li>
  );
}

"use client";

import { Pencil, Trash2 } from "lucide-react";
import { startTransition, useCallback, useMemo, useState } from "react";

import { ActionMenu, type MenuAction } from "@/shared/ui/action-menu/action-menu";
import { attempt } from "@/shared/web/attempt";

import { NoteEditor } from "./note-editor";
import type { NoteListChange, ShownNote } from "./note-list";
import { preview, type NoteResult, type NoteView } from "./note-view";

import styles from "./note-row.module.scss";

export type NoteRowProps = {
  readonly note: ShownNote;
  // The server action that saves an edit
  readonly edit: (id: string, text: string) => Promise<NoteResult>;
  // Shows a change in the list before the server has answered
  readonly onPending: (change: NoteListChange) => void;
  readonly onDelete: (note: NoteView) => void;
};

type Editing = { readonly draft: string; readonly error?: string };

export function NoteRow({ note, edit, onPending, onDelete }: NoteRowProps) {
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
        const result = await attempt(() => edit(note.id, text));
        if (!result.ok) {
          // Reopen with what was written, and why it was not saved
          setEditing({ draft: text, error: result.error });
        }
      });
    },
    [note.id, note.content, edit, onPending],
  );

  const actions = useMemo<ReadonlyArray<MenuAction>>(
    () => [{ label: "Sửa", icon: Pencil, onSelect: startEditing }],
    [startEditing],
  );

  const destructive = useMemo<MenuAction>(
    () => ({ label: "Xoá", icon: Trash2, onSelect: () => onDelete(note) }),
    [note, onDelete],
  );

  return (
    <li className={editing === undefined ? styles.card : styles.editing} aria-busy={note.saving}>
      {editing === undefined ? (
        <>
          <p className={styles.content}>{note.content}</p>
          <time className={styles.time} dateTime={note.createdAt}>
            {note.time}
          </time>
          {note.saving ? (
            <span className={styles.menuSpace} />
          ) : (
            <ActionMenu
              label={`Tuỳ chọn cho ghi chú "${preview(note.content)}"`}
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

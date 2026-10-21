"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { parseContent } from "@/shared/domain/content";
import { Button } from "@/shared/ui/button/button";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { currentDevice, enterSends } from "@/shared/web/enter-key";

import styles from "./note-editor.module.scss";

export type NoteEditorProps = {
  readonly initial: string;
  // Why the last save was refused, when it was
  readonly initialError?: string | undefined;
  // Called only with text that passes the same check the server makes
  readonly onSave: (text: string) => void;
  readonly onCancel: () => void;
};

export function NoteEditor({ initial, initialError, onSave, onCancel }: NoteEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState(initialError);
  const errorId = useId();
  const box = useRef<HTMLTextAreaElement>(null);

  // Open with the cursor at the end of the words, ready to carry on typing
  useEffect(() => {
    const textArea = box.current;
    if (textArea !== null) {
      textArea.focus();
      textArea.setSelectionRange(textArea.value.length, textArea.value.length);
    }
  }, []);

  const save = useCallback(() => {
    const checked = parseContent(draft);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    onSave(draft);
  }, [draft, onSave]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      save();
    },
    [save],
  );

  const change = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    setError(undefined);
  }, []);

  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      // Safari reports the Enter that ends an IME composition as keyCode 229 with isComposing false
      const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;
      if (enterSends({ key: event.key, shiftKey: event.shiftKey, isComposing }, currentDevice())) {
        event.preventDefault();
        save();
      }
    },
    [onCancel, save],
  );

  return (
    <form className={styles.editor} onSubmit={submit}>
      <TextArea
        ref={box}
        aria-label="Sửa ghi chú"
        value={draft}
        onChange={change}
        onKeyDown={keyDown}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
      />
      {error === undefined ? null : (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="quiet" onClick={onCancel}>
          Huỷ
        </Button>
        <Button variant="primary" type="submit">
          Lưu
        </Button>
      </div>
    </form>
  );
}

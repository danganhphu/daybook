"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import type { NoteListChange } from "@/features/notes/web/note-list";
import { clockTime, unsavedVersion, type NoteResult } from "@/features/notes/web/note-view";
import { parseContent } from "@/shared/domain/content";
import { IconButton } from "@/shared/ui/button/icon-button";
import { SendIcon } from "@/shared/ui/icon/icons";
import { TextArea } from "@/shared/ui/text-area/text-area";
import { useToastClearance } from "@/shared/ui/toast/use-toast-clearance";
import { attempt } from "@/shared/web/attempt";
import { currentDevice, enterSends } from "@/shared/web/enter-key";
import { useHydrated } from "@/shared/web/use-hydrated";

import styles from "./composer.module.scss";

export type ComposerProps = {
  // The server action that records the user's words
  readonly record: (text: string) => Promise<NoteResult>;
  // Shows the note in the list before the server has answered
  readonly onPending: (change: NoteListChange) => void;
};

// Tapping send must not take focus from the box, or the phone keyboard closes after every note
function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

export function Composer({ record, onPending }: ComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const errorId = useId();
  const form = useRef<HTMLFormElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const hydrated = useHydrated();
  // Docked at the bottom, so the Undo toast must sit above the box, not on it
  useToastClearance(form);

  // Words typed before React took over are in the box but not in state; without this, Ghi would send nothing
  useEffect(() => {
    const early = box.current?.value ?? "";
    if (early !== "") {
      setText(early);
    }
  }, []);

  const send = useCallback(() => {
    const typed = text;
    // An empty send does nothing, as in any chat
    if (typed.trim() === "") {
      return;
    }

    const checked = parseContent(typed);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    setText("");
    setError(undefined);
    startTransition(async () => {
      const now = Date.now();
      onPending({
        kind: "add",
        note: {
          id: crypto.randomUUID(),
          content: typed,
          createdAt: new Date(now).toISOString(),
          time: clockTime(now),
          version: unsavedVersion,
        },
      });

      const result = await attempt(() => record(typed));
      if (!result.ok) {
        // Never lose the user's words: put them back, ahead of anything typed since
        setText((current) => (current === "" ? typed : `${typed}\n${current}`));
        setError(result.error);
      }
    });
  }, [text, record, onPending]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      send();
    },
    [send],
  );

  const change = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    setError(undefined);
  }, []);

  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Safari reports the Enter that ends an IME composition as keyCode 229 with isComposing false
      const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;
      if (enterSends({ key: event.key, shiftKey: event.shiftKey, isComposing }, currentDevice())) {
        event.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <form ref={form} className={styles.composer} onSubmit={submit}>
      <div className={styles.field}>
        <TextArea
          ref={box}
          appearance="bare"
          aria-label="Ghi chú mới"
          placeholder="Gõ đơn, việc cần nhắc, ghi chú..."
          value={text}
          onChange={change}
          onKeyDown={keyDown}
          aria-invalid={error !== undefined}
          aria-describedby={error === undefined ? undefined : errorId}
        />
        <IconButton
          type="submit"
          icon={SendIcon}
          label="Ghi"
          variant="primary"
          disabled={!hydrated}
          onMouseDown={keepFocus}
        />
      </div>
      {error === undefined ? null : (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}

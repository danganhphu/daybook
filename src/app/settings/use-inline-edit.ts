"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";

export type InlineEdit = {
  readonly editing: boolean;
  readonly open: () => void;
  readonly close: () => void;
  // The ref for the button that opens the editor; focus comes back to it when the editor closes
  readonly opener: (button: HTMLElement | null) => void;
  // For the editor's field: Escape cancels, as it does in the note editor
  readonly cancelOnEscape: (event: KeyboardEvent<HTMLInputElement>) => void;
};

// A row that opens into a field where it stands. Focus goes back to the button that opened it, so a keyboard user
// is where they were.
export function useInlineEdit(): InlineEdit {
  const [editing, setEditing] = useState(false);
  const returnFocus = useRef(false);

  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => {
    returnFocus.current = true;
    setEditing(false);
  }, []);
  const opener = useCallback((button: HTMLElement | null) => {
    if (button !== null && returnFocus.current) {
      returnFocus.current = false;
      button.focus();
    }
  }, []);
  const cancelOnEscape = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    },
    [close],
  );

  return { editing, open, close, opener, cancelOnEscape };
}

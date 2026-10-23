"use client";

import { useCallback, useRef, type ChangeEvent } from "react";

import { IconButton } from "@/shared/ui/button/icon-button";
import { CalendarMonthIcon } from "@/shared/ui/icon/icons";

import styles from "./day-picker.module.scss";

export type DayPickerProps = {
  // The button's accessible name, e.g. "Chọn ngày"
  readonly label: string;
  // YYYY-MM-DD, as the date input takes them
  readonly day: string;
  readonly max?: string;
  readonly onPick: (day: string) => void;
};

// A button that opens the phone's own date picker. The input stays rendered under the button, unseen, because
// showPicker() refuses an input that is not rendered and the popover anchors to where the input is.
export function DayPicker({ label, day, max, onPick }: DayPickerProps) {
  const input = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    const field = input.current;
    if (field === null) {
      return;
    }

    try {
      field.showPicker();
    } catch {
      // A browser without showPicker() opens its picker on focus, as older iOS Safari does
      field.focus();
    }
  }, []);

  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.value;
      // Cleared, or the same day again: nothing to go to
      if (picked !== "" && picked !== day) {
        onPick(picked);
      }
    },
    [day, onPick],
  );

  return (
    <span className={styles.dayPicker}>
      <IconButton icon={CalendarMonthIcon} label={label} onClick={open} />
      <input
        ref={input}
        type="date"
        className={styles.input}
        value={day}
        max={max}
        onChange={change}
        tabIndex={-1}
        aria-hidden
      />
    </span>
  );
}

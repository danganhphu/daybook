"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { useHydrated } from "@/shared/web/use-hydrated";

import styles from "./suggest-field.module.scss";

export type Suggestion = {
  readonly key: string;
  readonly label: string;
  // Beside the label: an area, a last price
  readonly detail?: string | undefined;
};

export type SuggestFieldProps<Item> = {
  readonly label: string;
  readonly value: string;
  // Every keystroke; the text is the field's value whether or not a suggestion is picked
  readonly onValueChange: (text: string) => void;
  // What the server suggests for the text so far
  readonly suggest: (text: string) => Promise<ReadonlyArray<Item>>;
  readonly describe: (item: Item) => Suggestion;
  // A suggestion tapped, or chosen with Enter
  readonly onPick: (item: Item) => void;
  readonly placeholder?: string | undefined;
  // Said in the list when nothing matches, e.g. that typing a new name makes a new product
  readonly emptyText?: string | undefined;
  readonly error?: string | undefined;
  // Takes the focus when it appears, for a field the user just asked for, such as a new line
  readonly focusOnMount?: boolean | undefined;
};

// The server's suggestions, with the text they answer
type Answer<Item> = { readonly text: string; readonly items: ReadonlyArray<Item> };

// Free text with suggestions from the server as it is typed (Base UI's Autocomplete, async). Picking one fills the
// field and tells the form which it was; typing past them keeps the text as typed. A newer answer replaces an older
// one, and a late older one is dropped.
export function SuggestField<Item>({
  label,
  value,
  onValueChange,
  suggest,
  describe,
  onPick,
  placeholder,
  emptyText,
  error,
  focusOnMount = false,
}: SuggestFieldProps<Item>) {
  const [answer, setAnswer] = useState<Answer<Item>>({ text: "", items: [] });
  const [searching, startSearch] = useTransition();
  const [focused, setFocused] = useState(false);
  const latest = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const hintId = useId();
  const items = useMemo(() => [...answer.items], [answer.items]);
  const hydrated = useHydrated();
  const focus = useCallback(() => setFocused(true), []);
  const blur = useCallback(() => setFocused(false), []);

  useEffect(() => {
    if (focusOnMount && hydrated) {
      input.current?.focus();
    }
  }, [focusOnMount, hydrated]);

  const change = useCallback(
    (text: string) => {
      onValueChange(text);
      const asked = ++latest.current;
      if (text.trim() === "") {
        setAnswer({ text, items: [] });
        return;
      }

      startSearch(async () => {
        const found = await suggest(text);
        if (asked === latest.current) {
          startSearch(() => setAnswer({ text, items: found }));
        }
      });
    },
    [onValueChange, suggest],
  );

  const toString = useCallback((item: Item) => describe(item).label, [describe]);
  const renderItem = useCallback(
    (item: Item) => (
      <SuggestionItem key={describe(item).key} item={item} describe={describe} onPick={onPick} />
    ),
    [describe, onPick],
  );

  // Open only with something to pick, and only while the box has focus: an open popup takes the rest of the form out
  // of reach of a screen reader, so "nothing matches" is said under the field instead, and an answer arriving after
  // the user moved on must not cover the field they are in. Tapping a suggestion keeps the focus (Base UI).
  const [wantsOpen, setWantsOpen] = useState(false);
  const open = wantsOpen && focused && answer.items.length > 0;
  // Only for the words in the box: a name filled in for the user was never looked up
  const nothingFound =
    !searching &&
    answer.text === value &&
    value.trim() !== "" &&
    answer.items.length === 0 &&
    emptyText !== undefined;

  // Base UI's hidden form input carries a style attribute, which the CSP refuses in server HTML. The field is built in
  // the browser instead, and until then stands as the same box, waiting.
  if (!hydrated) {
    return (
      <div className={styles.field}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <input
          id={id}
          className={styles.input}
          placeholder={placeholder}
          value={value}
          readOnly
          disabled
        />
      </div>
    );
  }

  return (
    <Autocomplete.Root
      items={items}
      value={value}
      onValueChange={change}
      open={open}
      onOpenChange={setWantsOpen}
      itemToStringValue={toString}
      filter={null}
    >
      <div className={styles.field}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <Autocomplete.Input
          ref={input}
          id={id}
          className={styles.input}
          placeholder={placeholder}
          aria-invalid={error !== undefined}
          aria-describedby={nothingFound ? hintId : undefined}
          autoComplete="off"
          onFocus={focus}
          onBlur={blur}
        />
        {nothingFound ? (
          <p id={hintId} className={styles.hint}>
            {emptyText}
          </p>
        ) : null}
      </div>
      {error === undefined ? null : (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Autocomplete.Portal>
        <Autocomplete.Positioner className={styles.positioner} sideOffset={4} align="start">
          <Autocomplete.Popup className={styles.popup} aria-busy={searching || undefined}>
            <Autocomplete.List className={styles.list}>{renderItem}</Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function SuggestionItem<Item>({
  item,
  describe,
  onPick,
}: {
  readonly item: Item;
  readonly describe: (item: Item) => Suggestion;
  readonly onPick: (item: Item) => void;
}) {
  const shown = describe(item);
  // Fires for a tap and for Enter on the highlighted suggestion alike
  const pick = useCallback(() => onPick(item), [item, onPick]);

  return (
    <Autocomplete.Item value={item} className={styles.item} onClick={pick}>
      <span className={styles.itemLabel}>{shown.label}</span>
      {shown.detail === undefined ? null : (
        <span className={styles.itemDetail}>{shown.detail}</span>
      )}
    </Autocomplete.Item>
  );
}

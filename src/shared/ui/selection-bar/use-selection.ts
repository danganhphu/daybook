"use client";

import { useCallback, useMemo, useState } from "react";

export type Selection = {
  readonly choosing: boolean;
  // Only ids still shown: one gone from the list is no longer chosen
  readonly chosen: ReadonlySet<string>;
  readonly allChosen: boolean;
  readonly start: () => void;
  readonly stop: () => void;
  readonly toggle: (id: string, on: boolean) => void;
  readonly toggleAll: (on: boolean) => void;
};

// Choosing several rows of a list for one action, as a phone's own lists do: Chọn starts it, each row ticks, Chọn tất
// cả ticks them all, and leaving forgets what was ticked
export function useSelection(ids: ReadonlyArray<string>): Selection {
  const [choosing, setChoosing] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const chosen = useMemo(() => new Set(ids.filter((id) => ticked.has(id))), [ids, ticked]);

  const start = useCallback(() => setChoosing(true), []);
  const stop = useCallback(() => {
    setChoosing(false);
    setTicked(new Set());
  }, []);
  const toggle = useCallback((id: string, on: boolean) => {
    setTicked((current) => {
      const next = new Set(current);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);
  const toggleAll = useCallback((on: boolean) => setTicked(new Set(on ? ids : [])), [ids]);

  return {
    choosing,
    chosen,
    allChosen: ids.length > 0 && chosen.size === ids.length,
    start,
    stop,
    toggle,
    toggleAll,
  };
}

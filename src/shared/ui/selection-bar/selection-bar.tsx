"use client";

import { useRef, type ReactNode } from "react";

import { useToastClearance } from "@/shared/ui/toast/use-toast-clearance";

import styles from "./selection-bar.module.scss";

// The actions on what is chosen, docked at the foot of the screen while choosing, side by side: as the trash of the
// phone's own photo apps has them. The last thing in a Screen; toasts rise above it.
export function SelectionBar({ children }: { readonly children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  useToastClearance(bar);

  return (
    <div ref={bar} className={styles.bar} data-selection-bar="">
      {children}
    </div>
  );
}

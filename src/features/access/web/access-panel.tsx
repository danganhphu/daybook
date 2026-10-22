import Image from "next/image";
import type { ReactNode } from "react";

import { Status } from "@/shared/ui/status/status";

import styles from "./access-panel.module.scss";

export type AccessPanelProps = {
  readonly title: string;
  readonly description?: string;
  // What happened last, read out to screen readers as it changes
  readonly status?: string | undefined;
  // The one action the screen is for, at the bottom where the thumb is
  readonly children?: ReactNode;
};

// The frame for signing in and setting up: the app's mark, one sentence, one action. Nothing else competes.
export function AccessPanel({ title, description, status, children }: AccessPanelProps) {
  return (
    <main className={styles.screen}>
      <section className={styles.intro}>
        {/* Decorative: the title says what the screen is. An SVG needs no resizing. */}
        <Image className={styles.mark} src="/icon.svg" alt="" width={72} height={72} unoptimized />
        <h1 className={styles.title}>{title}</h1>
        {description === undefined ? null : <p className={styles.description}>{description}</p>}
      </section>
      <div className={styles.actions}>
        <Status message={status} />
        {children}
      </div>
    </main>
  );
}

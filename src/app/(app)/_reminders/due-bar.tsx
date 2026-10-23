"use client";

import Link from "next/link";
import { useCallback, useOptimistic } from "react";

import { preview } from "@/features/notes/web/note-view";
import type { DueView } from "@/features/reminders/web/reminder-view";
import { markDone, moreDue, remindersCopy } from "@/features/reminders/web/reminders-copy";
import { IconButton } from "@/shared/ui/button/icon-button";
import { ChevronRightIcon, RadioButtonUncheckedIcon } from "@/shared/ui/icon/icons";
import { routes } from "@/shared/web/routes";

import { useReminderChanges } from "./use-reminder-changes";

import styles from "./due-bar.module.scss";

const noneDone: ReadonlyArray<string> = [];

function withDone(done: ReadonlyArray<string>, id: string): ReadonlyArray<string> {
  return [...done, id];
}

// Under Hôm nay's header, so what is due stays in sight however long the day's notes run: the most overdue reminder
// with its check, and how many more, opening the full list
export function DueBar({ due }: { readonly due: DueView }) {
  const [done, hide] = useOptimistic(noneDone, withDone);
  const { complete } = useReminderChanges(hide);
  const { first, more } = due;
  const tick = useCallback(() => complete(first), [complete, first]);

  if (done.includes(first.id)) {
    return null;
  }

  return (
    <section className={styles.bar} aria-label={remindersCopy.title}>
      <IconButton
        icon={RadioButtonUncheckedIcon}
        label={markDone(preview(first.text))}
        onClick={tick}
      />
      <Link href={routes.reminders} prefetch={false} className={styles.link}>
        <span className={styles.text}>{first.text}</span>
        <span className={styles.detail}>
          {first.customer === undefined ? null : `${first.customer.name}, `}
          <span data-overdue={first.overdue ? "" : undefined}>{first.due}</span>
          {more > 0 ? <span className={styles.spoken}>, {moreDue(more)}</span> : null}
        </span>
        {more > 0 ? (
          <span aria-hidden className={styles.more}>
            +{more}
          </span>
        ) : null}
        <ChevronRightIcon aria-hidden className={styles.chevron} />
      </Link>
    </section>
  );
}

"use client";

import { Button } from "@base-ui/react/button";
import { useCallback } from "react";

import { actionLabels } from "@/shared/ui/action-labels";
import { AppLink } from "@/shared/ui/app-link/app-link";
import type { Icon } from "@/shared/ui/icon/icon";
import { NotificationsIcon, ReceiptLongIcon } from "@/shared/ui/icon/icons";

import { addCustomerNamed, readingCopy, unknownCustomer } from "./reading-copy";
import type { AnswerView, CandidateView, ReadingView } from "./reading-view";

import styles from "./note-reading.module.scss";

// A reading, or an answer to one, on its way to the server
export type ReadingPending = "reading" | "saving";

export type NoteReadingProps = {
  readonly noteId: string;
  readonly view: ReadingView | undefined;
  readonly pending: ReadingPending | undefined;
  readonly onReadAgain: (noteId: string) => void;
  readonly onAnswer: (noteId: string, answer: AnswerView) => void;
  // Opens the customer list, for a customer the message calls by another name
  readonly onPickCustomer: (noteId: string) => void;
};

// Under a note's words: what its message became, the question it waits on, or why it could not be read
export function NoteReading({
  noteId,
  view,
  pending,
  onReadAgain,
  onAnswer,
  onPickCustomer,
}: NoteReadingProps) {
  if (pending !== undefined) {
    return (
      <div className={styles.reading}>
        <output className={styles.quiet}>
          {pending === "reading" ? readingCopy.reading : actionLabels.saving}
        </output>
      </div>
    );
  }

  switch (view?.kind) {
    case undefined:
    case "unread":
      return null;
    case "order":
      return (
        <Made label={readingCopy.orderMade} path={view.path} icon={ReceiptLongIcon}>
          {view.summary}
        </Made>
      );
    case "reminder":
      return (
        <Made label={readingCopy.reminderMade} path={view.path} icon={NotificationsIcon}>
          {view.due}
        </Made>
      );
    case "unsure":
      return (
        <Unsure noteId={noteId} view={view} onAnswer={onAnswer} onPickCustomer={onPickCustomer} />
      );
    case "failed":
      return <Failed noteId={noteId} view={view} onReadAgain={onReadAgain} />;
    default:
      return view satisfies never;
  }
}

function Made({
  label,
  path,
  icon: Glyph,
  children,
}: {
  readonly label: string;
  readonly path: string;
  readonly icon: Icon;
  readonly children: string;
}) {
  return (
    <div className={styles.reading}>
      <AppLink href={path} prefetch={false} className={styles.made}>
        <Glyph aria-hidden />
        <span>
          <span className={styles.madeLabel}>{label}</span> {children}
        </span>
      </AppLink>
    </div>
  );
}

function Unsure({
  noteId,
  view,
  onAnswer,
  onPickCustomer,
}: {
  readonly noteId: string;
  readonly view: Extract<ReadingView, { kind: "unsure" }>;
  readonly onAnswer: NoteReadingProps["onAnswer"];
  readonly onPickCustomer: NoteReadingProps["onPickCustomer"];
}) {
  const addCustomer = useCallback(
    () => onAnswer(noteId, { kind: "new_customer" }),
    [noteId, onAnswer],
  );
  const dismiss = useCallback(() => onAnswer(noteId, { kind: "dismiss" }), [noteId, onAnswer]);
  const pick = useCallback(() => onPickCustomer(noteId), [noteId, onPickCustomer]);
  const { written, candidates } = view;

  return (
    <div className={styles.reading}>
      <p className={styles.quiet}>
        {view.question === "unknown" && written !== undefined
          ? unknownCustomer(written)
          : readingCopy.whose}
      </p>
      <div className={styles.choices}>
        {candidates.map((candidate) => (
          <CandidateChoice
            key={candidate.id}
            noteId={noteId}
            candidate={candidate}
            onAnswer={onAnswer}
          />
        ))}
        {written === undefined ? null : (
          <Button className={styles.choice} onClick={addCustomer}>
            {addCustomerNamed(written)}
          </Button>
        )}
        <Button className={styles.choice} onClick={pick}>
          {candidates.length === 0 ? readingCopy.pickCustomer : readingCopy.otherCustomer}
        </Button>
        <Button className={styles.choice} onClick={dismiss}>
          {readingCopy.notAnOrder}
        </Button>
      </div>
    </div>
  );
}

function CandidateChoice({
  noteId,
  candidate,
  onAnswer,
}: {
  readonly noteId: string;
  readonly candidate: CandidateView;
  readonly onAnswer: NoteReadingProps["onAnswer"];
}) {
  const choose = useCallback(
    () => onAnswer(noteId, { kind: "customer", customerId: candidate.id }),
    [noteId, candidate.id, onAnswer],
  );

  return (
    <Button className={styles.choice} onClick={choose}>
      {candidate.area === undefined ? candidate.name : `${candidate.name} (${candidate.area})`}
    </Button>
  );
}

function Failed({
  noteId,
  view,
  onReadAgain,
}: {
  readonly noteId: string;
  readonly view: Extract<ReadingView, { kind: "failed" }>;
  readonly onReadAgain: NoteReadingProps["onReadAgain"];
}) {
  const readAgain = useCallback(() => onReadAgain(noteId), [noteId, onReadAgain]);

  return (
    <div className={styles.reading}>
      <p className={styles.quiet}>{view.message}</p>
      {view.canReadAgain ? (
        <div className={styles.choices}>
          <Button className={styles.choice} onClick={readAgain}>
            {readingCopy.readAgain}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

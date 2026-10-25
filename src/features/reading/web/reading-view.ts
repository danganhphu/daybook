import type { Result } from "@/shared/domain/result";

// What the browser gets about a note's message: plain values across the server-client boundary

export type CandidateView = {
  readonly id: string;
  readonly name: string;
  readonly area: string | undefined;
};

export type ReadingView =
  // Never read: shows nothing, and the note's menu offers to read it
  | { readonly kind: "unread" }
  // "Hướng Dương: Thuốc tê x2, 500.000đ", opening the order
  | { readonly kind: "order"; readonly path: string; readonly summary: string }
  // "Ngày mai", opening the reminders
  | { readonly kind: "reminder"; readonly path: string; readonly due: string }
  | {
      readonly kind: "unsure";
      readonly question: "unknown" | "ambiguous";
      // The customer as the message writes them; offered as a new customer when there is one
      readonly written: string | undefined;
      readonly candidates: ReadonlyArray<CandidateView>;
    }
  | { readonly kind: "failed"; readonly message: string; readonly canReadAgain: boolean };

// A day's notes and what each message became, keyed by note id; a note with nothing to show is left out
export type DayReadings = {
  readonly byNote: Readonly<Record<string, ReadingView>>;
  // Whether a model is bound, so a note can be read again
  readonly canRead: boolean;
};

// What reading or answering made, for the toast that offers to undo it
export type MadeView =
  | { readonly kind: "order"; readonly id: string; readonly version: number }
  | { readonly kind: "reminder"; readonly id: string; readonly version: number }
  | { readonly kind: "nothing" };

export type ReadResult = Result<MadeView, string>;

// What a person answers a reading that asked whose order it is, as the browser sends it
export type AnswerView =
  | { readonly kind: "customer"; readonly customerId: string }
  | { readonly kind: "new_customer" }
  | { readonly kind: "dismiss" };

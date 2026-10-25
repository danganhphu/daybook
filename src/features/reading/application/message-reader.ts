import type { Temporal } from "temporal-polyfill/implementation";

import type { ReadFailure, Reader } from "@/features/reading/domain/interpretation";
import type { Reading } from "@/features/reading/domain/reading";
import type { Content } from "@/shared/domain/content";
import type { Result } from "@/shared/domain/result";

export type ReaderAnswer = {
  readonly reading: Reading;
  readonly reader: Reader;
  readonly neurons: number | undefined;
};

export type ReaderFailure = {
  readonly failure: Exclude<ReadFailure, "refused">;
  readonly reader: Reader;
  readonly neurons: number | undefined;
};

// Reads one message as of the day it was written. Failing is an answer, never a throw: the note stays a note.
export type MessageReader = {
  read(text: Content, today: Temporal.PlainDate): Promise<Result<ReaderAnswer, ReaderFailure>>;
};

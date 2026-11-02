import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import type { Content } from "@/shared/domain/content";

export const captureSources = ["web", "telegram"] as const;

export type CaptureSource = (typeof captureSources)[number];

export const captureIdSchema = z.uuid().brand<"CaptureId">();

export type CaptureId = z.infer<typeof captureIdSchema>;

export const sourceRefMaxLength = 64;

// Which message at the source: `<chat id>:<message id>` for Telegram, whose ids are integers
export const sourceRefSchema = z
  .string()
  .max(sourceRefMaxLength)
  .regex(/^-?\d+:\d+$/)
  .brand<"SourceRef">();

export type SourceRef = z.infer<typeof sourceRefSchema>;

export function telegramSourceRef(chatId: number, messageId: number): SourceRef {
  return sourceRefSchema.parse(`${chatId}:${messageId}`);
}

// What the user sent, exactly, and when. Never edited, never deleted: everything they later see is derived from it,
// and keeping it whole is what makes re-reading it with a better parser possible.
export type Capture = {
  readonly id: CaptureId;
  readonly content: Content;
  readonly source: CaptureSource;
  // A Telegram message's own identity, so an update Telegram sends again is found, not stored twice; none for the web
  readonly sourceRef: SourceRef | undefined;
  // Who typed it: two people share one book
  readonly authorId: AccountId;
  readonly receivedAt: Temporal.Instant;
};

export function receive(
  content: Content,
  source: "web",
  authorId: AccountId,
  receivedAt: Temporal.Instant,
): Capture;
export function receive(
  content: Content,
  source: "telegram",
  authorId: AccountId,
  receivedAt: Temporal.Instant,
  sourceRef: SourceRef,
): Capture;
export function receive(
  content: Content,
  source: CaptureSource,
  authorId: AccountId,
  receivedAt: Temporal.Instant,
  sourceRef?: SourceRef,
): Capture {
  return { id: captureIdSchema.parse(uuidv7()), content, source, sourceRef, authorId, receivedAt };
}

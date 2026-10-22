import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/features/access/domain/account";
import type { Content } from "@/shared/domain/content";

export const captureSources = ["web", "telegram"] as const;

export type CaptureSource = (typeof captureSources)[number];

export const captureIdSchema = z.uuid().brand<"CaptureId">();

export type CaptureId = z.infer<typeof captureIdSchema>;

// What the user sent, exactly, and when. Never edited, never deleted: everything they later see is derived from it,
// and keeping it whole is what makes re-reading it with a better parser possible.
export type Capture = {
  readonly id: CaptureId;
  readonly content: Content;
  readonly source: CaptureSource;
  // Who typed it: two people share one book
  readonly authorId: AccountId;
  readonly receivedAt: Temporal.Instant;
};

export function receive(
  content: Content,
  source: CaptureSource,
  authorId: AccountId,
  receivedAt: Temporal.Instant,
): Capture {
  return { id: captureIdSchema.parse(uuidv7()), content, source, authorId, receivedAt };
}

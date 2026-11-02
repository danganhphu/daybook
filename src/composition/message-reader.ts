import { z } from "zod";

import type { MessageReader } from "@/features/reading/application/message-reader";
import {
  createReplayReader,
  replayTableSchema,
} from "@/features/reading/infrastructure/replay-reader";
import {
  createWorkersAiReader,
  type ModelRunner,
} from "@/features/reading/infrastructure/workers-ai-reader";

export const readerBindingsSchema = z.object({
  // Workers AI, bound everywhere but in the end-to-end build
  AI: z
    .custom<ModelRunner>((value) => typeof value === "object" && value !== null && "run" in value)
    .optional(),
  // The end-to-end build's stand-in for a model, as JSON: each message its tests send, and what it says
  REPLAY_READINGS: z.string().optional(),
});

// What reads notes here: the model, the end-to-end build's table, or nothing, and then notes stay notes
export function readerFrom(
  parsed: z.infer<typeof readerBindingsSchema>,
): MessageReader | undefined {
  if (parsed.AI !== undefined) {
    return createWorkersAiReader(parsed.AI);
  }
  if (parsed.REPLAY_READINGS !== undefined) {
    const table = replayTableSchema.parse(JSON.parse(parsed.REPLAY_READINGS));
    return createReplayReader(new Map(Object.entries(table)));
  }

  return undefined;
}

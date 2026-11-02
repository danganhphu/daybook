import { z } from "zod";

import type { ReplyJob } from "@/bot/reply-job";
import { accessEventIdSchema } from "@/features/access/domain/access-event";
import { noteIdSchema } from "@/features/notes/domain/note";
import type { NotificationJob } from "@/features/notifications/application/notification-job";
import { digestKinds } from "@/features/notifications/domain/notification-preference";
import { accountIdSchema } from "@/shared/domain/account-id";

// Everything the queue carries: the notifications' deliveries and the bot's replies
export type Job = NotificationJob | ReplyJob;

// What a queue message may hold. Checked on the way out of the queue too: a message can outlive the deploy that wrote it.
export const jobMessageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("digest"),
    digest: z.enum(digestKinds),
    accountId: accountIdSchema,
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal("notice"),
    accountId: accountIdSchema,
    eventId: accessEventIdSchema,
  }),
  z.object({
    kind: z.literal("reply"),
    accountId: accountIdSchema,
    noteId: noteIdSchema,
    chatId: z.int(),
    messageId: z.int(),
    again: z.boolean(),
    cardId: z.int().optional(),
  }),
]) satisfies z.ZodType<Job>;

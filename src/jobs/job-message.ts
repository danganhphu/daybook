import { z } from "zod";

import { accessEventIdSchema } from "@/features/access/domain/access-event";
import type { NotificationJob } from "@/features/notifications/application/notification-job";
import { digestKinds } from "@/features/notifications/domain/notification-preference";
import { accountIdSchema } from "@/shared/domain/account-id";

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
]) satisfies z.ZodType<NotificationJob>;

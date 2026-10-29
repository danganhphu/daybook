import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import type { DeliverySubject } from "./delivery";

// Read as a module: `import * as InboxItems`

export const inboxItemIdSchema = z.uuid().brand<"InboxItemId">();

export type InboxItemId = z.infer<typeof inboxItemIdSchema>;

export const inboxLimits = {
  title: 200,
  body: 2000,
  path: 500,
  // The list shows the newest this many
  listed: 50,
} as const;

// One notification as the list in the app keeps it: the words it said, and where a tap goes
export type InboxItem = {
  readonly id: InboxItemId;
  readonly accountId: AccountId;
  readonly subject: DeliverySubject;
  // The day or the event it is about, as in the ledger: one item each
  readonly ref: string;
  readonly title: string;
  readonly body: string;
  readonly path: string;
  readonly createdAt: Temporal.Instant;
  // Undefined until the person opens the list
  readonly readAt: Temporal.Instant | undefined;
};

export type InboxItemDetails = Pick<
  InboxItem,
  "accountId" | "subject" | "ref" | "title" | "body" | "path"
>;

function clipped(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

// A path inside the app, never another site's address
export function isInApp(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function create(details: InboxItemDetails, at: Temporal.Instant): InboxItem {
  if (!isInApp(details.path)) {
    throw new Error(`An inbox item opens a path in the app, not ${details.path}`);
  }

  return {
    ...details,
    id: inboxItemIdSchema.parse(uuidv7()),
    title: clipped(details.title, inboxLimits.title),
    body: clipped(details.body, inboxLimits.body),
    createdAt: at,
    readAt: undefined,
  };
}

export function isUnread(item: InboxItem): boolean {
  return item.readAt === undefined;
}

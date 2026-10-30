import type { Temporal } from "temporal-polyfill/implementation";

import type { Session } from "@/features/access/domain/session";
import {
  inboxLimits,
  type InboxItem,
  type InboxItemId,
} from "@/features/notifications/domain/inbox-item";
import type { InboxRepository } from "@/features/notifications/domain/inbox-repository";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

import type { InboxWrites } from "./notification-writes";

export type NotificationInboxDeps = {
  readonly clock: Clock;
  readonly inbox: InboxRepository;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly inbox: InboxWrites }>;
};

// The person's list, newest first, as it stands: reading it changes nothing
export function notificationInbox(
  deps: NotificationInboxDeps,
  session: Session,
): Promise<ReadonlyArray<InboxItem>> {
  return deps.inbox.list(session.accountId, inboxLimits.listed);
}

// The list was seen up to its newest item: everything unread until then is read. One made after, while the page was
// open, stays unread.
export async function markInboxRead(
  deps: NotificationInboxDeps,
  session: Session,
  upTo: Temporal.Instant,
): Promise<void> {
  const work = deps.startUnitOfWork();
  work.inbox.markRead(session.accountId, upTo, deps.clock());
  await work.commit();
}

// Gone from the person's list for good, no trash: they are what the app said, not what anyone wrote in the book.
// Only the person's own; an id that is not theirs, or is gone already, changes nothing.
export async function deleteInboxItems(
  deps: NotificationInboxDeps,
  session: Session,
  ids: ReadonlyArray<InboxItemId>,
): Promise<void> {
  const work = deps.startUnitOfWork();
  work.inbox.remove(session.accountId, ids);
  await work.commit();
}

export async function clearInbox(deps: NotificationInboxDeps, session: Session): Promise<void> {
  const work = deps.startUnitOfWork();
  work.inbox.removeAll(session.accountId);
  await work.commit();
}

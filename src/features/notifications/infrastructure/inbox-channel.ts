import type { NotificationChannel } from "@/features/notifications/application/notification-channel";
import type { InboxWrites } from "@/features/notifications/application/notification-writes";
import * as InboxItems from "@/features/notifications/domain/inbox-item";
import { pushMessageFor } from "@/features/notifications/web/push-text";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";

export type InboxChannelDeps = {
  readonly clock: Clock;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly inbox: InboxWrites }>;
};

// The list behind the bell: every notification, in the words a push would show, whichever other channel reaches the
// person or none does
export function createInboxChannel(deps: InboxChannelDeps): NotificationChannel {
  return {
    name: "inbox",

    async send(accountId, content, ref) {
      const { message } = pushMessageFor(content, ref);
      const work = deps.startUnitOfWork();
      work.inbox.add(
        InboxItems.create(
          {
            accountId,
            subject: content.kind,
            ref,
            title: message.title,
            body: message.body,
            path: message.path,
          },
          deps.clock(),
        ),
      );
      await work.commit();

      return { kind: "sent" };
    },
  };
}

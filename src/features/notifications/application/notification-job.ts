import type { AccessEventId } from "@/features/access/domain/access-event";
import type { DigestKind } from "@/features/notifications/domain/notification-preference";
import type { AccountId } from "@/shared/domain/account-id";

// A delivery waiting on the queue. Ids and a day only: what it says is read when it is sent, never carried.
export type NotificationJob =
  | {
      readonly kind: "digest";
      readonly digest: DigestKind;
      readonly accountId: AccountId;
      // YYYY-MM-DD, the Vietnamese day it is for
      readonly day: string;
    }
  | { readonly kind: "notice"; readonly accountId: AccountId; readonly eventId: AccessEventId };

export type JobSender = {
  send(jobs: ReadonlyArray<NotificationJob>): Promise<void>;
};

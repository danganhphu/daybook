import type { DeliveryChannel } from "@/features/notifications/domain/delivery";
import type { AccountId } from "@/shared/domain/account-id";

import type { NotificationContent } from "./notification-content";

export type ChannelOutcome =
  | { readonly kind: "sent" }
  // Nowhere to send it: no device of this person's is signed in with notifications on
  | { readonly kind: "unreachable" }
  | { readonly kind: "retry"; readonly afterSeconds: number | undefined };

// One way of reaching a person: the web's push, later Telegram. `ref` names the delivery (a day, an event), so a
// channel can tell a repeat from a new one.
export type NotificationChannel = {
  readonly name: DeliveryChannel;
  send(accountId: AccountId, content: NotificationContent, ref: string): Promise<ChannelOutcome>;
};

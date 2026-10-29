import type { DeliverySubject } from "@/features/notifications/domain/delivery";

export type InboxRowView = {
  readonly id: string;
  readonly subject: DeliverySubject;
  readonly title: string;
  readonly body: string;
  // "14:15" today, "Hôm qua", or the date
  readonly when: string;
  readonly href: string;
  readonly unread: boolean;
};

export type InboxView = {
  readonly rows: ReadonlyArray<InboxRowView>;
  readonly footer: string;
  // The newest item's time, sent back once the list is on screen to mark it read; none when nothing is unread
  readonly readUpTo: number | undefined;
};

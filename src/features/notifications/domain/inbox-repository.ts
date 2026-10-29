import type { AccountId } from "@/shared/domain/account-id";

import type { InboxItem } from "./inbox-item";

// Reads only
export type InboxRepository = {
  // Newest first
  list(accountId: AccountId, limit: number): Promise<ReadonlyArray<InboxItem>>;
  unreadCount(accountId: AccountId): Promise<number>;
};

import type { AccountId } from "@/shared/domain/account-id";

import type { NotificationPreference } from "./notification-preference";

// Reads only. Only what someone has saved: an account missing here has the defaults.
export type NotificationPreferenceRepository = {
  get(accountId: AccountId): Promise<NotificationPreference | undefined>;
  getMany(
    accountIds: ReadonlyArray<AccountId>,
  ): Promise<ReadonlyMap<AccountId, NotificationPreference>>;
};

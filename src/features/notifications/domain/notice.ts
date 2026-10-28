import type { AccessEvent, AccessEventKind } from "@/features/access/domain/access-event";
import type { AccountId } from "@/shared/domain/account-id";

// The changes to how someone signs in that reach that person on every channel, whoever made them (ADR 0009): a way in
// added or taken away, a recovery link, devices signed out by the other person, a new device receiving notifications
export const noticeKinds = [
  "passkey_added",
  "passkey_removed",
  "password_set",
  "password_changed",
  "password_locked",
  "username_changed",
  "setup_link_issued",
  "setup_link_redeemed",
  "sessions_revoked",
  "push_subscribed",
] as const satisfies ReadonlyArray<AccessEventKind>;

export type NoticeKind = (typeof noticeKinds)[number];

const kinds: ReadonlySet<AccessEventKind> = new Set(noticeKinds);

// An invite's link concerns nobody yet, and a first setup's an account with no device
const recoveryOnly: ReadonlySet<AccessEventKind> = new Set([
  "setup_link_issued",
  "setup_link_redeemed",
]);

export type Notice = AccessEvent & { readonly kind: NoticeKind; readonly accountId: AccountId };

export function isNotice(event: AccessEvent): event is Notice {
  return (
    event.accountId !== undefined &&
    kinds.has(event.kind) &&
    (!recoveryOnly.has(event.kind) || event.detail?.["purpose"] === "recovery")
  );
}

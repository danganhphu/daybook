import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";

import type { PasskeyId } from "./passkey";
import type { DeviceLabel, SessionId } from "./session";

// Read as a module: `import * as AccessEvents` then `AccessEvents.record(...)`

export const accessEventIdSchema = z.uuid().brand<"AccessEventId">();

export type AccessEventId = z.infer<typeof accessEventIdSchema>;

// Every kind the sign-in plan records, then the notifications' and the bot's, each added ahead of its feature so the
// table's check is rebuilt as rarely as possible. Names follow the OWASP logging vocabulary's spirit: what happened,
// in the past tense.
export const accessEventKinds = [
  "account_created",
  "setup_link_issued",
  "setup_link_redeemed",
  "setup_link_refused",
  "session_opened",
  "session_ended",
  "other_sessions_ended",
  "sessions_revoked",
  "passkey_added",
  "passkey_removed",
  "sign_in_failed",
  "password_set",
  "password_changed",
  "password_locked",
  "username_changed",
  "display_name_changed",
  "rate_limited",
  "push_subscribed",
  "push_unsubscribed",
  "telegram_linked",
  "telegram_unlinked",
  "telegram_link_refused",
] as const;

export type AccessEventKind = (typeof accessEventKinds)[number];

export const ipAddressSchema = z.union([z.ipv4(), z.ipv6()]).brand<"IpAddress">();

export type IpAddress = z.infer<typeof ipAddressSchema>;

// Where a request came from. The operator's command has no IP.
export type RequestOrigin = {
  readonly ip: IpAddress | undefined;
  readonly deviceLabel: DeviceLabel;
};

// Small facts that explain an event, such as a link's purpose. Never a secret, a token, a challenge or a key.
export type AccessEventDetail = Readonly<Record<string, string>>;

export type AccessEvent = RequestOrigin & {
  readonly id: AccessEventId;
  readonly occurredAt: Temporal.Instant;
  readonly kind: AccessEventKind;
  // Whose account it concerns, and who did it: they differ when one user makes a recovery link for the other.
  // The actor is undefined for the operator's command and for someone not yet signed in.
  readonly accountId: AccountId | undefined;
  readonly actorId: AccountId | undefined;
  readonly sessionId: SessionId | undefined;
  readonly passkeyId: PasskeyId | undefined;
  readonly detail: AccessEventDetail | undefined;
};

export type AccessEventSubject = {
  readonly accountId?: AccountId | undefined;
  readonly actorId?: AccountId | undefined;
  readonly sessionId?: SessionId | undefined;
  readonly passkeyId?: PasskeyId | undefined;
  readonly detail?: AccessEventDetail | undefined;
};

export function record(
  kind: AccessEventKind,
  subject: AccessEventSubject,
  origin: RequestOrigin,
  now: Temporal.Instant,
): AccessEvent {
  return {
    id: accessEventIdSchema.parse(uuidv7()),
    occurredAt: now,
    kind,
    accountId: subject.accountId,
    actorId: subject.actorId,
    sessionId: subject.sessionId,
    passkeyId: subject.passkeyId,
    detail: subject.detail,
    ip: origin.ip,
    deviceLabel: origin.deviceLabel,
  };
}

import type { Temporal } from "temporal-polyfill/implementation";

import * as AccessEvents from "@/features/access/domain/access-event";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountId } from "@/features/access/domain/account";
import type { PasskeyId } from "@/features/access/domain/passkey";
import * as Sessions from "@/features/access/domain/session";
import type { AuthenticationMethod, Session, SessionId } from "@/features/access/domain/session";

import type { AccessEventWrites, SessionWrites } from "./access-writes";
import { hashSecretToken, newSecretToken } from "./secret-tokens";
import type { Secrets } from "./secrets";
import { formatSessionCookie } from "./session-cookie";

export type SessionStores = {
  readonly sessions: SessionWrites;
  readonly accessEvents: AccessEventWrites;
};

export type NewSessionRequest = {
  readonly accountId: AccountId;
  readonly method: AuthenticationMethod;
  readonly passkeyId: PasskeyId | undefined;
  readonly origin: RequestOrigin;
  // The session this browser held before, ended in the same commit: every sign-in gets a new id (ASVS 7.2.4)
  readonly replacing: SessionId | undefined;
};

export type OpenedSession = {
  readonly session: Session;
  // The value for the browser's cookie. Its secret exists nowhere else.
  readonly cookie: string;
};

// For the use cases that have just authenticated someone, and for nothing else: it queues the session on their unit
// of work, so it exists only if everything else they write commits too.
export async function enlistNewSession(
  work: SessionStores,
  secrets: Secrets,
  request: NewSessionRequest,
  now: Temporal.Instant,
): Promise<OpenedSession> {
  const secret = newSecretToken(secrets);
  const session = Sessions.open(
    {
      accountId: request.accountId,
      verifier: await hashSecretToken(secrets, secret),
      method: request.method,
      passkeyId: request.passkeyId,
      deviceLabel: request.origin.deviceLabel,
    },
    now,
  );

  if (request.replacing !== undefined) {
    work.sessions.remove(request.replacing);
  }
  work.sessions.add(session);
  work.accessEvents.add(
    AccessEvents.record(
      "session_opened",
      {
        accountId: session.accountId,
        actorId: session.accountId,
        sessionId: session.id,
        passkeyId: session.passkeyId,
        detail: { method: session.method },
      },
      request.origin,
      now,
    ),
  );

  return { session, cookie: formatSessionCookie({ sessionId: session.id, secret }) };
}

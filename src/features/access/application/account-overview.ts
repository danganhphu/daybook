import type { Temporal } from "temporal-polyfill/implementation";

import type { AccessEvent } from "@/features/access/domain/access-event";
import type { AccessEventRepository } from "@/features/access/domain/access-event-repository";
import type { Account } from "@/features/access/domain/account";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { Passkey } from "@/features/access/domain/passkey";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import * as Passwords from "@/features/access/domain/password";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { AccountId } from "@/shared/domain/account-id";

export type AccountOverviewDeps = {
  readonly accounts: AccountRepository;
  readonly passkeys: PasskeyRepository;
  readonly passwords: PasswordRepository;
  readonly sessions: SessionRepository;
  readonly accessEvents: AccessEventRepository;
};

export type PasswordStatus =
  | { readonly kind: "none" }
  | { readonly kind: "set"; readonly locked: boolean; readonly changedAt: Temporal.Instant };

// A device, as the list shows it: never the session's verifier, which only the sign-in check has any use for
export type SessionSummary = Omit<Session, "verifier">;

// Someone who shares the book, as the people list shows them
export type PersonSummary = {
  readonly account: Account;
  readonly lastSignInAt: Temporal.Instant | undefined;
  // False for an invite left half-way, or a phone lost with no password: the other user can send a recovery link
  readonly hasWayIn: boolean;
};

// What the account settings show, read in one go. Never a salt or a verifier: only whether there is a password.
export type AccountOverview = {
  readonly account: Account;
  readonly passkeys: ReadonlyArray<Passkey>;
  readonly password: PasswordStatus;
  readonly sessions: ReadonlyArray<SessionSummary>;
  readonly activity: ReadonlyArray<AccessEvent>;
  readonly people: ReadonlyArray<PersonSummary>;
};

// Enough to recognise what happened lately without scrolling through months
const activityShown = 20;

// Field by field, so a field added to Session later stays out until someone chooses to show it
function summarize(session: Session): SessionSummary {
  return {
    id: session.id,
    accountId: session.accountId,
    method: session.method,
    passkeyId: session.passkeyId,
    authenticatedAt: session.authenticatedAt,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    deviceLabel: session.deviceLabel,
  };
}

async function hasWayIn(deps: AccountOverviewDeps, accountId: AccountId): Promise<boolean> {
  const [passkeys, password] = await Promise.all([
    deps.passkeys.listForAccount(accountId),
    deps.passwords.get(accountId),
  ]);

  return passkeys.length > 0 || (password !== undefined && !Passwords.isLocked(password));
}

async function listPeople(deps: AccountOverviewDeps): Promise<ReadonlyArray<PersonSummary>> {
  const [accounts, lastSignIns] = await Promise.all([
    deps.accounts.list(),
    deps.accessEvents.lastSignIns(),
  ]);

  return Promise.all(
    accounts.map(async (account) => ({
      account,
      lastSignInAt: lastSignIns.get(account.id),
      hasWayIn: await hasWayIn(deps, account.id),
    })),
  );
}

export async function accountOverview(
  deps: AccountOverviewDeps,
  accountId: AccountId,
): Promise<AccountOverview> {
  const [account, passkeys, password, sessions, activity, people] = await Promise.all([
    deps.accounts.get(accountId),
    deps.passkeys.listForAccount(accountId),
    deps.passwords.get(accountId),
    deps.sessions.listForAccount(accountId),
    deps.accessEvents.listForAccount(accountId, activityShown),
    listPeople(deps),
  ]);
  if (account === undefined) {
    throw new Error(`Account ${accountId} does not exist`);
  }

  return {
    account,
    passkeys,
    password:
      password === undefined
        ? { kind: "none" }
        : { kind: "set", locked: Passwords.isLocked(password), changedAt: password.changedAt },
    sessions: sessions.map(summarize),
    activity,
    people,
  };
}

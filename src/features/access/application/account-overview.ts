import type { Temporal } from "temporal-polyfill/implementation";

import type { AccessEvent } from "@/features/access/domain/access-event";
import type { AccessEventRepository } from "@/features/access/domain/access-event-repository";
import type { Account } from "@/features/access/domain/account";
import type { AccountRepository } from "@/features/access/domain/account-repository";
import type { Passkey } from "@/features/access/domain/passkey";
import type { PasskeyRepository } from "@/features/access/domain/passkey-repository";
import * as Passwords from "@/features/access/domain/password";
import type { Password } from "@/features/access/domain/password";
import type { PasswordRepository } from "@/features/access/domain/password-repository";
import type { Session } from "@/features/access/domain/session";
import type { SessionRepository } from "@/features/access/domain/session-repository";
import type { Clock } from "@/shared/application/clock";
import type { AccountId } from "@/shared/domain/account-id";

import { listSessions } from "./list-sessions";

export type AccountOverviewDeps = {
  readonly clock: Clock;
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
  // The log's latest, of the last 30 days
  readonly activity: ReadonlyArray<AccessEvent>;
  // Older ones within the 30 days, past those shown
  readonly moreActivity: boolean;
  readonly people: ReadonlyArray<PersonSummary>;
};

// The sign-in log shows the last 30 days, a page at a time: enough to recognise what happened lately without scrolling
// through months
export const activityLimits = { days: 30, page: 30, most: 300 } as const;

const hoursPerDay = 24;

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

function hasWayIn(passkeys: ReadonlyArray<Passkey>, password: Password | undefined): boolean {
  return passkeys.length > 0 || (password !== undefined && !Passwords.isLocked(password));
}

// Everyone's passkeys and passwords are read once, and each person's taken from them: a query per person grew the
// page's reads with every account
// `activityShown`: how many of the log's latest the screen shows; it asks for one more to know whether there are more
export async function accountOverview(
  deps: AccountOverviewDeps,
  accountId: AccountId,
  activityShown: number = activityLimits.page,
): Promise<AccountOverview> {
  const since = deps.clock().subtract({ hours: activityLimits.days * hoursPerDay });
  const shown = Math.min(activityShown, activityLimits.most);
  const [accounts, allPasskeys, allPasswords, sessions, activity, lastSignIns] = await Promise.all([
    deps.accounts.list(),
    deps.passkeys.list(),
    deps.passwords.list(),
    listSessions(deps, accountId),
    deps.accessEvents.listForAccount(accountId, shown + 1, since),
    deps.accessEvents.lastSignIns(),
  ]);
  const account = accounts.find((each) => each.id === accountId);
  if (account === undefined) {
    throw new Error(`Account ${accountId} does not exist`);
  }
  const passkeysOf = (id: AccountId) => allPasskeys.filter((passkey) => passkey.accountId === id);
  const passwordOf = (id: AccountId) => allPasswords.find((each) => each.accountId === id);
  const password = passwordOf(accountId);

  return {
    account,
    passkeys: passkeysOf(accountId),
    password:
      password === undefined
        ? { kind: "none" }
        : { kind: "set", locked: Passwords.isLocked(password), changedAt: password.changedAt },
    sessions: sessions.map(summarize),
    activity: activity.slice(0, shown),
    // At the most a screen lists, asking for more would bring the same rows
    moreActivity: activity.length > shown && shown < activityLimits.most,
    people: accounts.map((each) => ({
      account: each,
      lastSignInAt: lastSignIns.get(each.id),
      hasWayIn: hasWayIn(passkeysOf(each.id), passwordOf(each.id)),
    })),
  };
}

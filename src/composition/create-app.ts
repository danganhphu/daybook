import type { Temporal } from "temporal-polyfill/implementation";

import { accountOverview } from "@/features/access/application/account-overview";
import { authenticate } from "@/features/access/application/authenticate";
import { beginPasswordChange } from "@/features/access/application/begin-password-change";
import { beginPasswordSignIn } from "@/features/access/application/begin-password-sign-in";
import { changeDisplayName } from "@/features/access/application/change-display-name";
import { changeUsername } from "@/features/access/application/change-username";
import { endOtherSessions } from "@/features/access/application/end-other-sessions";
import { endSession } from "@/features/access/application/end-session";
import {
  finishAddingPasskey,
  type FinishAddingPasskeyRequest,
} from "@/features/access/application/finish-adding-passkey";
import {
  finishPasskeySetup,
  type FinishPasskeySetupRequest,
} from "@/features/access/application/finish-passkey-setup";
import {
  finishPasskeySignIn,
  type FinishPasskeySignInRequest,
} from "@/features/access/application/finish-passkey-sign-in";
import {
  finishPasswordChange,
  type FinishPasswordChangeRequest,
} from "@/features/access/application/finish-password-change";
import {
  finishPasswordSignIn,
  type FinishPasswordSignInRequest,
} from "@/features/access/application/finish-password-sign-in";
import { issueInvite } from "@/features/access/application/issue-invite";
import { issueRecoveryLink } from "@/features/access/application/issue-recovery-link";
import { listSessions } from "@/features/access/application/list-sessions";
import {
  nameInvitedAccount,
  type NameInvitedAccountRequest,
} from "@/features/access/application/name-invited-account";
import type { Peppers } from "@/features/access/application/peppers";
import { redeemSetupLink } from "@/features/access/application/redeem-setup-link";
import { removePasskey } from "@/features/access/application/remove-passkey";
import { resumeSetup } from "@/features/access/application/resume-setup";
import { signOut } from "@/features/access/application/sign-out";
import { startAddingPasskey } from "@/features/access/application/start-adding-passkey";
import { startPasskeySetup } from "@/features/access/application/start-passkey-setup";
import {
  startPasskeySignIn,
  type StartPasskeySignInRequest,
} from "@/features/access/application/start-passkey-sign-in";
import type { RequestOrigin } from "@/features/access/domain/access-event";
import type { AccountId, DisplayName, Username } from "@/features/access/domain/account";
import type { Session } from "@/features/access/domain/session";
import { createAccessEventRepository } from "@/features/access/infrastructure/access-event-repository";
import { createAccountRepository } from "@/features/access/infrastructure/account-repository";
import { createCeremonyRepository } from "@/features/access/infrastructure/ceremony-repository";
import { createRateLimiter } from "@/features/access/infrastructure/d1-rate-limiter";
import { createPasskeyRepository } from "@/features/access/infrastructure/passkey-repository";
import { createPasswordRepository } from "@/features/access/infrastructure/password-repository";
import { createSessionRepository } from "@/features/access/infrastructure/session-repository";
import { createSetupLinkRepository } from "@/features/access/infrastructure/setup-link-repository";
import {
  createSimpleWebAuthnVerifier,
  type RelyingParty,
} from "@/features/access/infrastructure/simple-webauthn-verifier";
import { webCryptoSecrets } from "@/features/access/infrastructure/web-crypto-secrets";
import {
  recordCapture,
  type RecordCaptureInput,
} from "@/features/capture/application/record-capture";
import { deleteNote } from "@/features/notes/application/delete-note";
import { editNote, type EditNoteInput } from "@/features/notes/application/edit-note";
import { listNotesForDay } from "@/features/notes/application/list-notes-for-day";
import { listNotesForToday } from "@/features/notes/application/list-notes-for-today";
import { restoreNote } from "@/features/notes/application/restore-note";
import type { NoteId } from "@/features/notes/domain/note";
import { createNoteRepository } from "@/features/notes/infrastructure/note-repository";
import type { Clock } from "@/shared/application/clock";
import { createDatabase } from "@/shared/infrastructure/d1/database";
import { systemClock } from "@/shared/infrastructure/system-clock";

import { createUnitOfWork } from "./unit-of-work";

export type App = ReturnType<typeof createApp>;

// What the app runs on: the database, who the passkeys belong to, and the pepper for passwords
export type AppBindings = {
  readonly db: D1Database;
  readonly relyingParty: RelyingParty;
  readonly peppers: Peppers;
};

// The composition root: the one place that knows which implementation stands behind each port.
// Adapters - the web app, the Telegram bot - receive an App and never reach past it.
export function createApp(bindings: AppBindings, clock: Clock = systemClock) {
  const db = createDatabase(bindings.db);
  const notes = createNoteRepository(db);
  const accounts = createAccountRepository(db);
  const ceremonies = createCeremonyRepository(db);
  const passkeys = createPasskeyRepository(db);
  const passwords = createPasswordRepository(db);
  const sessions = createSessionRepository(db);
  const setupLinks = createSetupLinkRepository(db);
  const rateLimiter = createRateLimiter(db);
  const accessEvents = createAccessEventRepository(db);
  const verifier = createSimpleWebAuthnVerifier(bindings.relyingParty);
  const secrets = webCryptoSecrets;
  const startUnitOfWork = () => createUnitOfWork(db);
  const access = {
    clock,
    secrets,
    accounts,
    ceremonies,
    passkeys,
    passwords,
    peppers: bindings.peppers,
    sessions,
    setupLinks,
    rateLimiter,
    accessEvents,
    verifier,
    startUnitOfWork,
  };

  return {
    recordCapture: (input: RecordCaptureInput) => recordCapture({ clock, startUnitOfWork }, input),
    editNote: (input: EditNoteInput) => editNote({ clock, notes, startUnitOfWork }, input),
    deleteNote: (id: NoteId) => deleteNote({ clock, notes, startUnitOfWork }, id),
    restoreNote: (id: NoteId) => restoreNote({ notes, startUnitOfWork }, id),
    listNotesForDay: (day: Temporal.PlainDate) => listNotesForDay({ notes }, day),
    listNotesForToday: () => listNotesForToday({ clock, notes }),

    authenticate: (cookie: string | undefined) => authenticate(access, cookie),
    redeemSetupLink: (token: string, origin: RequestOrigin) =>
      redeemSetupLink(access, token, origin),
    startPasskeySetup: (ceremonyCookie: string | undefined) =>
      startPasskeySetup(access, ceremonyCookie),
    finishPasskeySetup: (request: FinishPasskeySetupRequest) => finishPasskeySetup(access, request),
    startPasskeySignIn: (request: StartPasskeySignInRequest) => startPasskeySignIn(access, request),
    finishPasskeySignIn: (request: FinishPasskeySignInRequest) =>
      finishPasskeySignIn(access, request),
    beginPasswordSignIn: (username: unknown, origin: RequestOrigin) =>
      beginPasswordSignIn(access, { username, origin }),
    finishPasswordSignIn: (request: FinishPasswordSignInRequest) =>
      finishPasswordSignIn(access, request),
    beginPasswordChange: (session: Session) => beginPasswordChange(access, session),
    finishPasswordChange: (session: Session, request: FinishPasswordChangeRequest) =>
      finishPasswordChange(access, session, request),
    signOut: (session: Session, origin: RequestOrigin) =>
      signOut({ clock, startUnitOfWork }, session, origin),
    endOtherSessions: (session: Session, origin: RequestOrigin) =>
      endOtherSessions(access, session, origin),
    listSessions: (accountId: AccountId) => listSessions({ sessions }, accountId),
    accountOverview: (accountId: AccountId) => accountOverview(access, accountId),
    changeDisplayName: (session: Session, displayName: DisplayName, origin: RequestOrigin) =>
      changeDisplayName(access, session, displayName, origin),
    changeUsername: (session: Session, username: Username, origin: RequestOrigin) =>
      changeUsername(access, session, username, origin),
    startAddingPasskey: (session: Session) => startAddingPasskey(access, session),
    finishAddingPasskey: (session: Session, request: FinishAddingPasskeyRequest) =>
      finishAddingPasskey(access, session, request),
    removePasskey: (session: Session, passkeyId: unknown, origin: RequestOrigin) =>
      removePasskey(access, session, passkeyId, origin),
    endSession: (session: Session, otherId: unknown, origin: RequestOrigin) =>
      endSession(access, session, otherId, origin),
    issueInvite: (session: Session, origin: RequestOrigin) => issueInvite(access, session, origin),
    issueRecoveryLink: (session: Session, accountId: unknown, origin: RequestOrigin) =>
      issueRecoveryLink(access, session, accountId, origin),
    nameInvitedAccount: (request: NameInvitedAccountRequest) => nameInvitedAccount(access, request),
    resumeSetup: (ceremonyCookie: string | undefined) => resumeSetup(access, ceremonyCookie),
  } as const;
}

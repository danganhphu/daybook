import type { Temporal } from "temporal-polyfill/implementation";

import { backupPasswordTerm, passkeyTerm } from "@/features/access/application/access-terms";
import type {
  AccountOverview,
  PersonSummary,
} from "@/features/access/application/account-overview";
import type { AccessEvent, AccessEventKind } from "@/features/access/domain/access-event";
import type { AccountId } from "@/features/access/domain/account";
import type { SessionId } from "@/features/access/domain/session";
import { setupLinkPurposes, type SetupLinkPurpose } from "@/features/access/domain/setup-link";
import { vietnamTimeZone } from "@/shared/domain/vietnam-time-zone";
import { midSentence } from "@/shared/web/sentence-case";

import { accessCopy } from "./access-copy";
import { providerName } from "./passkey-providers";

// The account settings as the screen shows them: words and dates, ready to render. Ids stay so the screen can say
// which row an action is for; nothing secret ever gets this far.

export type PasskeyRow = { readonly id: string; readonly title: string; readonly detail: string };

export type DeviceRow = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly current: boolean;
};

export type ActivityRow = { readonly id: string; readonly title: string; readonly detail: string };

export type PasswordRow =
  | { readonly kind: "none" }
  | { readonly kind: "set"; readonly locked: boolean; readonly detail: string };

export type PersonRow = {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly detail: string;
  // Everyone but the viewer can be sent a recovery link; the viewer adds a way in from their own settings
  readonly isYou: boolean;
};

export type AccountView = {
  readonly displayName: string;
  readonly username: string;
  readonly passkeys: ReadonlyArray<PasskeyRow>;
  readonly password: PasswordRow;
  readonly devices: ReadonlyArray<DeviceRow>;
  readonly activity: ReadonlyArray<ActivityRow>;
  readonly people: ReadonlyArray<PersonRow>;
};

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

// "16:02 22/10", in Vietnam's time whatever the server's. Put together by hand: the Worker's ICU writes vi-VN's
// day and month as "22-10", which is not how anyone here writes a date.
export function formatMoment(instant: Temporal.Instant): string {
  const { hour, minute, day, month } = instant.toZonedDateTimeISO(vietnamTimeZone);

  return `${twoDigits(hour)}:${twoDigits(minute)} ${twoDigits(day)}/${twoDigits(month)}`;
}

const linkNames: Readonly<Record<SetupLinkPurpose, string>> = {
  first_setup: "link cài đặt",
  invite: "link mời",
  recovery: "link khôi phục",
};

const eventTitles: Readonly<Record<AccessEventKind, string>> = {
  account_created: "Tạo tài khoản",
  setup_link_issued: `Tạo ${linkNames.first_setup}`,
  setup_link_redeemed: `Mở ${linkNames.first_setup}`,
  setup_link_refused: "Link cài đặt không dùng được",
  session_opened: accessCopy.signIn,
  session_ended: accessCopy.signOut,
  other_sessions_ended: accessCopy.signOutOthers,
  sessions_revoked: "Đăng xuất khỏi mọi thiết bị",
  passkey_added: accessCopy.addPasskey,
  passkey_removed: accessCopy.removePasskey,
  sign_in_failed: "Đăng nhập không thành công",
  password_set: `Đặt ${backupPasswordTerm}`,
  password_changed: `Đổi ${backupPasswordTerm}`,
  password_locked: "Mật khẩu bị khoá vì nhập sai nhiều lần",
  username_changed: accessCopy.changeUsername,
  display_name_changed: accessCopy.changeDisplayName,
  rate_limited: "Tạm chặn vì thử quá nhiều lần",
};

function isPurpose(value: string | undefined): value is SetupLinkPurpose {
  return setupLinkPurposes.some((purpose) => purpose === value);
}

// What happened, without who
function whatHappened(event: AccessEvent): string {
  const purpose = event.detail?.["purpose"];
  switch (event.kind) {
    case "session_opened":
      return event.detail?.["method"] === "password"
        ? "Đăng nhập bằng mật khẩu"
        : `Đăng nhập bằng ${passkeyTerm}`;
    case "session_ended":
      return event.detail?.["by"] === "another_device"
        ? "Đăng xuất từ thiết bị khác"
        : eventTitles.session_ended;
    case "setup_link_issued":
      return isPurpose(purpose) ? `Tạo ${linkNames[purpose]}` : eventTitles.setup_link_issued;
    case "setup_link_redeemed":
      return isPurpose(purpose) ? `Mở ${linkNames[purpose]}` : eventTitles.setup_link_redeemed;
    default:
      return eventTitles[event.kind];
  }
}

// Who did it to whom, when that was not the viewer: "Lan tạo link khôi phục" on Minh's list, "Tạo link khôi phục
// cho Minh" on Lan's
function eventTitle(
  event: AccessEvent,
  viewer: AccountId,
  nameOf: (id: AccountId) => string | undefined,
): string {
  const title = whatHappened(event);
  const subject =
    event.accountId !== undefined && event.accountId !== viewer
      ? nameOf(event.accountId)
      : undefined;
  const actor =
    event.actorId !== undefined && event.actorId !== viewer ? nameOf(event.actorId) : undefined;
  const forWhom = subject === undefined ? title : `${title} cho ${subject}`;

  return actor === undefined ? forWhom : `${actor} ${midSentence(forWhom)}`;
}

function lastUsed(instant: Temporal.Instant): string {
  return `Dùng lần cuối ${formatMoment(instant)}`;
}

function personStatus(person: PersonSummary): string {
  if (!person.hasWayIn) {
    return "chưa có cách đăng nhập";
  }

  return person.lastSignInAt === undefined
    ? "chưa đăng nhập lần nào"
    : `đăng nhập lần cuối ${formatMoment(person.lastSignInAt)}`;
}

export function toAccountView(overview: AccountOverview, current: SessionId): AccountView {
  const viewer = overview.account.id;
  const names = new Map(overview.people.map(({ account }) => [account.id, account.displayName]));
  const nameOf = (id: AccountId) => names.get(id);

  return {
    displayName: overview.account.displayName,
    username: overview.account.username,
    passkeys: overview.passkeys.map((passkey) => ({
      id: passkey.id,
      title: providerName(passkey.aaguid) ?? passkey.name,
      detail:
        passkey.lastUsedAt === undefined
          ? `Thêm lúc ${formatMoment(passkey.createdAt)}`
          : lastUsed(passkey.lastUsedAt),
    })),
    password:
      overview.password.kind === "none"
        ? { kind: "none" }
        : {
            kind: "set",
            locked: overview.password.locked,
            detail: overview.password.locked
              ? "Đang bị khoá vì nhập sai nhiều lần. Hãy đặt mật khẩu mới."
              : `Đổi lúc ${formatMoment(overview.password.changedAt)}`,
          },
    devices: overview.sessions.map((session) => ({
      id: session.id,
      title: session.deviceLabel,
      detail: session.id === current ? accessCopy.thisDevice : lastUsed(session.lastSeenAt),
      current: session.id === current,
    })),
    activity: overview.activity.map((event) => ({
      id: event.id,
      title: eventTitle(event, viewer, nameOf),
      detail: `${formatMoment(event.occurredAt)}, ${event.deviceLabel}`,
    })),
    people: overview.people.map((person) => {
      const isYou = person.account.id === viewer;

      return {
        id: person.account.id,
        displayName: person.account.displayName,
        title: isYou ? `${person.account.displayName} (bạn)` : person.account.displayName,
        detail: `${person.account.username}, ${personStatus(person)}`,
        isYou,
      };
    }),
  };
}

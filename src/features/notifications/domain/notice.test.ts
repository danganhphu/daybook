import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as AccessEvents from "@/features/access/domain/access-event";
import type { AccessEventDetail, AccessEventKind } from "@/features/access/domain/access-event";
import { origin } from "@/testing/support/access";
import { anAuthorId } from "@/testing/support/app";

import { isNotice } from "./notice";

function event(kind: AccessEventKind, detail?: AccessEventDetail, accountId = anAuthorId) {
  return AccessEvents.record(
    kind,
    { accountId, detail },
    origin(),
    Temporal.Instant.from("2026-10-28T01:00:00Z"),
  );
}

describe("isNotice", () => {
  it.each<[AccessEventKind, AccessEventDetail | undefined]>([
    ["passkey_added", undefined],
    ["password_changed", undefined],
    ["password_locked", undefined],
    ["sessions_revoked", { by: "other_user" }],
    ["setup_link_issued", { purpose: "recovery" }],
    ["setup_link_redeemed", { purpose: "recovery" }],
    ["push_subscribed", undefined],
  ])("given %s, when sorted, then the person is told", (kind, detail) => {
    expect(isNotice(event(kind, detail))).toBe(true);
  });

  it.each<[AccessEventKind, AccessEventDetail | undefined]>([
    ["session_opened", { method: "passkey" }],
    ["sign_in_failed", undefined],
    ["display_name_changed", undefined],
    ["setup_link_issued", { purpose: "invite" }],
    ["setup_link_redeemed", { purpose: "first_setup" }],
    ["push_unsubscribed", undefined],
  ])("given %s, when sorted, then it is not a notice", (kind, detail) => {
    expect(isNotice(event(kind, detail))).toBe(false);
  });

  it("given an event about no account, when sorted, then there is nobody to tell", () => {
    const aboutNobody = AccessEvents.record(
      "passkey_added",
      {},
      origin(),
      Temporal.Instant.from("2026-10-28T01:00:00Z"),
    );

    expect(isNotice(aboutNobody)).toBe(false);
  });
});

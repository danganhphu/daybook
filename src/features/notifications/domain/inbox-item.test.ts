import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { anAuthorId } from "@/testing/support/app";

import * as InboxItems from "./inbox-item";
import { inboxLimits } from "./inbox-item";

const at = Temporal.Instant.from("2026-10-29T00:30:00Z");

function details(changes: Partial<InboxItems.InboxItemDetails>): InboxItems.InboxItemDetails {
  return {
    accountId: anAuthorId,
    subject: "morning",
    ref: "2026-10-29",
    title: "Hôm nay có 2 việc",
    body: "giao 2 hộp thuốc tê",
    path: "/reminders",
    ...changes,
  };
}

describe("InboxItems.create", () => {
  it("given a notification's words, when kept, then it is unread and made now", () => {
    const item = InboxItems.create(details({}), at);

    expect([item.title, item.createdAt.equals(at), InboxItems.isUnread(item)]).toEqual([
      "Hôm nay có 2 việc",
      true,
      true,
    ]);
  });

  it.each(["https://evil.example/", "//evil.example/", "reminders"])(
    "given the path %s, when kept, then it is refused: a tap only ever opens the app",
    (path) => {
      expect(() => InboxItems.create(details({ path }), at)).toThrow(/a path in the app/);
    },
  );

  it("given words longer than the list keeps, when kept, then they are cut short and say so", () => {
    const item = InboxItems.create(details({ body: "x".repeat(inboxLimits.body + 10) }), at);

    expect(item.body).toHaveLength(inboxLimits.body);
    expect(item.body.endsWith("...")).toBe(true);
  });
});

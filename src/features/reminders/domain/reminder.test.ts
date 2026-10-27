import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";
import { contentSchema } from "@/shared/domain/content-schema";
import { expectOk } from "@/testing/support/result";

import * as Reminders from "./reminder";

const maker = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000a1");
const partner = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000b2");
const created = Temporal.Instant.from("2026-10-23T01:00:00Z");
const later = Temporal.Instant.from("2026-10-23T02:00:00Z");

const details = {
  text: contentSchema.parse("Gọi nha khoa Sao Mai hỏi lịch giao"),
  dueOn: Temporal.PlainDate.from("2026-10-24"),
  customerId: undefined,
};

describe("Reminders", () => {
  it("given a new reminder, when done by the other person and reopened, then each change is one version and the completion says who", () => {
    const reminder = Reminders.create(details, undefined, maker, created);

    const done = expectOk(Reminders.complete(reminder, partner, later));
    const reopened = expectOk(Reminders.reopen(done, maker, later));

    expect(done.completion).toEqual({ doneAt: later, doneBy: partner });
    expect(done.audit.version).toBe(2);
    expect(reopened).toEqual({
      ...reminder,
      audit: { ...reminder.audit, updatedAt: later, updatedBy: maker, version: 3 },
    });
  });

  it("given a done reminder, when done again, then it refuses; an open one cannot be reopened", () => {
    const reminder = Reminders.create(details, undefined, maker, created);
    const done = expectOk(Reminders.complete(reminder, maker, later));

    expect(Reminders.complete(done, maker, later)).toEqual({ ok: false, error: "reminder_done" });
    expect(Reminders.reopen(reminder, maker, later)).toEqual({
      ok: false,
      error: "reminder_open",
    });
  });

  it("given a deleted reminder, when revised, done or reopened, then it refuses; deleting it again changes nothing", () => {
    const deleted = Reminders.markDeleted(
      Reminders.create(details, undefined, maker, created),
      maker,
      later,
    );

    expect(Reminders.revise(deleted, details, maker, later)).toEqual({
      ok: false,
      error: "reminder_deleted",
    });
    expect(Reminders.complete(deleted, maker, later)).toEqual({
      ok: false,
      error: "reminder_deleted",
    });
    expect(Reminders.reopen(deleted, maker, later)).toEqual({
      ok: false,
      error: "reminder_deleted",
    });
    expect(Reminders.markDeleted(deleted, partner, later)).toBe(deleted);
  });

  it("given a deleted reminder that was done, when restored, then it is back done, without the deletion", () => {
    const done = expectOk(
      Reminders.complete(Reminders.create(details, undefined, maker, created), maker, later),
    );
    const deleted = Reminders.markDeleted(done, partner, later);

    const restored = expectOk(Reminders.restore(deleted, maker, later));

    expect(restored.status).toBe("live");
    expect(restored.completion).toEqual(done.completion);
    expect(restored).not.toHaveProperty("deletion");
    expect(Reminders.restore(restored, maker, later)).toEqual({
      ok: false,
      error: "reminder_not_deleted",
    });
  });
});

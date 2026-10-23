import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import type { CustomerId } from "@/features/customers/domain/customer";
import type { ReminderDetails } from "@/features/reminders/domain/reminder";
import {
  changeOf,
  content,
  recordNote,
  testApp,
  testClock,
  theAuthor,
  thePartner,
} from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

function anApp() {
  return testApp(testClock("2026-10-23T01:00:00Z").clock);
}

function details(text: string, dueOn: string, customerId?: CustomerId): ReminderDetails {
  return { text: content(text), dueOn: Temporal.PlainDate.from(dueOn), customerId };
}

async function aReminder(
  app: ReturnType<typeof anApp>,
  text: string,
  dueOn = "2026-10-23",
  customerId?: CustomerId,
) {
  return expectOk(
    await app.addReminder({
      by: await theAuthor(),
      details: details(text, dueOn, customerId),
      fromNote: undefined,
    }),
  );
}

async function openTexts(app: ReturnType<typeof anApp>, dueBy?: string, customerId?: CustomerId) {
  const open = await app.listOpenReminders(
    { dueBy: dueBy === undefined ? undefined : Temporal.PlainDate.from(dueBy), customerId },
    50,
  );

  return open.map((reminder) => reminder.text);
}

describe("reminders", () => {
  it("given reminders on several days, when listed as due today, then the overdue and today's come soonest first and later ones wait", async () => {
    const app = anApp();
    await aReminder(app, "Gửi báo giá găng tay", "2026-10-24");
    await aReminder(app, "Gọi nha khoa Sao Mai", "2026-10-23");
    await aReminder(app, "Thu tiền Hướng Dương", "2026-10-21");

    expect(await openTexts(app, "2026-10-23")).toEqual([
      "Thu tiền Hướng Dương",
      "Gọi nha khoa Sao Mai",
    ]);
    expect(await openTexts(app)).toHaveLength(3);
  });

  it("given reminders for two customers, when listed for one, then only theirs are there", async () => {
    const app = anApp();
    const sunflower = await aCustomer(app, "Hướng Dương");
    const morning = await aCustomer(app, "Sao Mai");
    await aReminder(app, "Mang mẫu kim mới", "2026-10-25", sunflower.id);
    await aReminder(app, "Hỏi lịch giao", "2026-10-25", morning.id);

    expect(await openTexts(app, undefined, sunflower.id)).toEqual(["Mang mẫu kim mới"]);
  });

  it("given a hidden customer, when a reminder is added for them, then it is refused; one already theirs keeps them on edit", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const reminder = await aReminder(app, "Gọi lại", "2026-10-25", customer.id);
    expectOk(await app.archiveCustomer(changeOf(customer, by)));

    expect(
      await app.addReminder({
        by,
        details: details("Gọi lần nữa", "2026-10-26", customer.id),
        fromNote: undefined,
      }),
    ).toEqual({ ok: false, error: "customer_unavailable" });
    const revised = expectOk(
      await app.reviseReminder({
        ...changeOf(reminder, by),
        details: details("Gọi lại sau 9 giờ", "2026-10-25", customer.id),
      }),
    );
    expect(revised.text).toBe("Gọi lại sau 9 giờ");
  });

  it("given a note, when it becomes a reminder, then the reminder keeps the note's capture; a deleted note cannot", async () => {
    const app = anApp();
    const by = await theAuthor();
    const note = await recordNote(app, "nha khoa Minh Châu hẹn gọi lại thứ 5");

    const reminder = expectOk(
      await app.addReminder({
        by,
        details: details(note.content, "2026-10-29"),
        fromNote: note.id,
      }),
    );
    expectOk(await app.deleteNote(changeOf(note, by)));

    expect(reminder.captureId).toBe(note.captureId);
    expect((await app.getReminder(reminder.id))?.captureId).toBe(note.captureId);
    expect(
      await app.addReminder({ by, details: details("lần nữa", "2026-10-29"), fromNote: note.id }),
    ).toEqual({ ok: false, error: "note_unavailable" });
  });

  it("given a reminder, when the other person marks it done and it is reopened, then it leaves the open list and comes back", async () => {
    const app = anApp();
    const reminder = await aReminder(app, "Gọi nha khoa Sao Mai");

    const done = expectOk(await app.completeReminder(changeOf(reminder, await thePartner())));
    const doneOpen = await openTexts(app);
    const reopened = expectOk(await app.reopenReminder(changeOf(done, await theAuthor())));

    expect((await app.getReminder(reminder.id))?.completion?.doneBy).toBeUndefined();
    expect(done.completion?.doneBy).toBe(await thePartner());
    expect(doneOpen).toEqual([]);
    expect(reopened.audit.version).toBe(3);
    expect(await openTexts(app)).toEqual(["Gọi nha khoa Sao Mai"]);
  });

  it("given a reminder done on one phone, when the other phone marks it done from its old screen, then it says it changed elsewhere", async () => {
    const app = anApp();
    const reminder = await aReminder(app, "Gọi nha khoa Sao Mai");
    expectOk(await app.completeReminder(changeOf(reminder, await thePartner())));

    expect(await app.completeReminder(changeOf(reminder, await theAuthor()))).toEqual({
      ok: false,
      error: "reminder_changed_elsewhere",
    });
  });

  it("given a reminder, when deleted twice and restored, then it is gone from the list, the second delete changes nothing, and Undo brings it back", async () => {
    const app = anApp();
    const by = await theAuthor();
    const reminder = await aReminder(app, "Gọi nha khoa Sao Mai");

    const deleted = expectOk(await app.deleteReminder(changeOf(reminder, by)));
    const again = expectOk(await app.deleteReminder(changeOf(reminder, by)));
    const listed = await openTexts(app);
    expectOk(await app.restoreReminder(changeOf(deleted, by)));

    expect(again.audit.version).toBe(deleted.audit.version);
    expect(listed).toEqual([]);
    expect(await openTexts(app)).toEqual(["Gọi nha khoa Sao Mai"]);
  });
});

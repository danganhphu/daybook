import { describe, expect, it } from "vitest";

import { recordNote, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

import {
  addReminder,
  completeReminder,
  dueReminders,
  remindersScreen,
  reopenReminder,
} from "./commands";

// 10:00 in Vietnam on Friday 23 October
function anApp() {
  return testApp(testClock("2026-10-23T03:00:00Z").clock);
}

async function added(app: ReturnType<typeof anApp>, text: string, dueOn: string, customerId = "") {
  return expectOk(await addReminder(app, await theAuthor(), { text, dueOn, customerId }));
}

describe("reminder screens", () => {
  it("given reminders across the week, when the list is shown, then they are grouped overdue, today, tomorrow and by date", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Hướng Dương");
    await added(app, "Gửi báo giá", "2026-10-27");
    await added(app, "Gọi lại", "2026-10-24");
    await added(app, "Thu tiền", "2026-10-21", customer.id);
    await added(app, "Mang mẫu kim", "2026-10-23");

    const view = await remindersScreen(app);

    expect(view.groups.map((group) => group.label)).toEqual([
      "Quá hạn",
      "Hôm nay",
      "Ngày mai",
      "Thứ Ba, 27/10",
    ]);
    expect(view.groups[0]?.reminders[0]).toMatchObject({
      text: "Thu tiền",
      due: "Quá hạn 2 ngày",
      overdue: true,
      customer: { id: customer.id, name: "Hướng Dương" },
    });
  });

  it("given three reminders due by today, when Hôm nay asks, then it gets the most overdue and how many more", async () => {
    const app = anApp();
    await added(app, "Hôm nay", "2026-10-23");
    await added(app, "Trễ một ngày", "2026-10-22");
    await added(app, "Tuần sau", "2026-10-30");
    await added(app, "Cũng hôm nay", "2026-10-23");

    expect(await dueReminders(app)).toMatchObject({
      first: { text: "Trễ một ngày", due: "Quá hạn 1 ngày" },
      more: 2,
    });
  });

  it("given nothing due, when Hôm nay asks, then there is nothing to show", async () => {
    const app = anApp();
    await added(app, "Tuần sau", "2026-10-30");

    expect(await dueReminders(app)).toBeUndefined();
  });
});

describe("reminder commands", () => {
  it.each([
    [{ text: "   ", dueOn: "2026-10-24", customerId: "" }, "Chưa có nội dung"],
    [
      { text: "Gọi lại", dueOn: "2026-02-30", customerId: "" },
      "Việc cần nhắc chưa đủ: cần nội dung và ngày.",
    ],
    [
      { text: "Gọi lại", dueOn: "2026-10-24", customerId: "không phải id" },
      "Việc cần nhắc chưa đủ: cần nội dung và ngày.",
    ],
    [{ text: "Gọi lại" }, "Việc cần nhắc chưa đủ: cần nội dung và ngày."],
  ])("given %j, when added, then it is refused with %s", async (input, message) => {
    expect(await addReminder(anApp(), await theAuthor(), input)).toEqual({
      ok: false,
      error: message,
    });
  });

  it("given a note's id, when added from it, then the reminder is made; an unknown note is said to be gone", async () => {
    const app = anApp();
    const by = await theAuthor();
    const note = await recordNote(app, "hẹn gọi lại thứ 5");

    expectOk(
      await addReminder(app, by, {
        text: note.content,
        dueOn: "2026-10-29",
        customerId: "",
        noteId: note.id,
      }),
    );
    expect(
      await addReminder(app, by, {
        text: "x",
        dueOn: "2026-10-29",
        customerId: "",
        noteId: "019a0000-0000-7000-8000-00000000ffff",
      }),
    ).toEqual({ ok: false, error: "Không tìm thấy ghi chú này nữa." });
  });

  it("given a reminder, when done and undone through the commands, then each answers the version for the next change", async () => {
    const app = anApp();
    const by = await theAuthor();
    const id = await added(app, "Gọi lại", "2026-10-23");

    const done = expectOk(await completeReminder(app, by, id, 1));
    const reopened = expectOk(await reopenReminder(app, by, id, done));

    expect([done, reopened]).toEqual([2, 3]);
    expect(await completeReminder(app, by, id, 1)).toEqual({
      ok: false,
      error: "Việc này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
    });
    expect(await completeReminder(app, by, "không phải id", 1)).toEqual({
      ok: false,
      error: "Không tìm thấy việc này nữa.",
    });
  });
});

import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { err, ok } from "@/shared/domain/result";
import { recordNote, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { aLine, anOrderReading, aReminderReading, readerOf } from "@/testing/support/readings";

import { answerReading, dayReadings, readNote } from "./commands";

const monday = Temporal.PlainDate.from("2026-10-26");

function anApp(answers: Parameters<typeof readerOf>[0]) {
  return testApp(testClock("2026-10-26T02:00:00Z").clock, readerOf(answers));
}

describe("dayReadings", () => {
  it("given notes read into an order, a reminder, a question and failures, when the day is shown, then each note says what came of it", async () => {
    const app = anApp({
      "bán 2 hộp thuốc tê cho nk Hướng Dương 500k": anOrderReading("nk Hướng Dương", [
        aLine("Thuốc tê", 2, "500k"),
        aLine("Kim", 3, null),
      ]),
      "mai gọi nk Hướng Dương": aReminderReading("nk Hướng Dương", "mai", "2026-10-27"),
      "bán 1 hộp kim cho chị Thu 100k": anOrderReading("chị Thu", [aLine("kim", 1, "100k")]),
      "hết lượt": "quota",
      "không đọc được": "schema",
      "bán một món tên quá dài": anOrderReading("nk Hướng Dương", [
        aLine("x".repeat(150), 1, "1k"),
      ]),
    });
    await aCustomer(app, "Nha khoa Hướng Dương", { area: "Quận 3" });
    const by = await theAuthor();
    const unread = "chưa đọc";
    const notes = await Promise.all(
      [
        "bán 2 hộp thuốc tê cho nk Hướng Dương 500k",
        "mai gọi nk Hướng Dương",
        "bán 1 hộp kim cho chị Thu 100k",
        "hết lượt",
        "không đọc được",
        "bán một món tên quá dài",
        unread,
      ].map(async (text) => {
        const note = await recordNote(app, text);
        if (text !== unread) {
          await readNote(app, by, note.id, false);
        }
        return note.id;
      }),
    );

    const readings = await dayReadings(app, monday);

    expect(readings.canRead).toBe(true);
    expect(notes.map((id) => readings.byNote[id])).toEqual([
      {
        kind: "order",
        path: expect.stringMatching(/^\/orders\//),
        summary: "Nha khoa Hướng Dương: Thuốc tê x2, Kim x3, chưa đủ giá",
      },
      { kind: "reminder", path: "/reminders", due: "Ngày mai" },
      { kind: "unsure", question: "unknown", written: "chị Thu", candidates: [] },
      {
        kind: "failed",
        message: "Hôm nay hết lượt đọc tin. Từ 7 giờ sáng mai đọc lại được.",
        canReadAgain: true,
      },
      { kind: "failed", message: "Chưa đọc được tin này.", canReadAgain: true },
      // Read again, the same order would be refused again
      { kind: "failed", message: "Chưa ghi được đơn từ tin này.", canReadAgain: false },
      { kind: "unread" },
    ]);
  });

  it("given an order with every line priced, when shown, then its total is said", async () => {
    const text = "bán 2 hộp thuốc tê cho nk Hướng Dương 500k";
    const app = anApp({ [text]: anOrderReading("nk Hướng Dương", [aLine("Thuốc tê", 2, "500k")]) });
    await aCustomer(app, "Nha khoa Hướng Dương");
    const note = await recordNote(app, text);
    await readNote(app, await theAuthor(), note.id, false);

    expect((await dayReadings(app, monday)).byNote[note.id]).toMatchObject({
      summary: "Nha khoa Hướng Dương: Thuốc tê x2, 500.000đ",
    });
  });

  it("given no reader, when the day is shown, then a failed note offers no reading again", async () => {
    const app = testApp(testClock("2026-10-26T02:00:00Z").clock);
    await recordNote(app, "bán 1 hộp kim");

    const readings = await dayReadings(app, monday);

    expect(readings.canRead).toBe(false);
    expect(Object.values(readings.byNote)).toEqual([{ kind: "unread" }]);
  });
});

describe("readNote and answerReading", () => {
  it("given an order made, when read, then the browser is told what to undo", async () => {
    const text = "bán 1 hộp kim cho chị Thu 100k";
    const app = anApp({ [text]: anOrderReading("chị Thu", [aLine("kim", 1, "100k")]) });
    const by = await theAuthor();
    const note = await recordNote(app, text);

    expect(await readNote(app, by, note.id, false)).toEqual(ok({ kind: "nothing" }));
    expect(await answerReading(app, by, note.id, { kind: "new_customer" })).toEqual(
      ok({ kind: "order", id: expect.any(String), version: 1 }),
    );
    // Already answered: the refreshed screen shows what came of it, so there is nothing to say
    expect(await answerReading(app, by, note.id, { kind: "dismiss" })).toEqual(
      ok({ kind: "nothing" }),
    );
  });

  it.each([
    ["a note id that is not one", "lạ", { kind: "dismiss" }],
    ["an answer of an unknown kind", undefined, { kind: "maybe" }],
    ["a customer id that is not one", undefined, { kind: "customer", customerId: "x" }],
  ])("given %s, when answered, then it is refused with a sentence", async (_, id, given) => {
    const app = anApp({});
    const note = await recordNote(app, "bán 1 hộp kim");

    expect(await answerReading(app, await theAuthor(), id ?? note.id, given)).toEqual(
      err("Không tìm thấy ghi chú này nữa."),
    );
  });
});

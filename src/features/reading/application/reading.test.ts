import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import type { LiveNote } from "@/features/notes/domain/note";
import type { MessageReader } from "@/features/reading/application/message-reader";
import { replayReader } from "@/features/reading/infrastructure/replay-reader";
import { err, ok } from "@/shared/domain/result";
import {
  changeOf,
  content,
  recordNote,
  testApp,
  testClock,
  theAuthor,
} from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import {
  aLine,
  anOrderReading,
  aReading,
  aReminderReading,
  readerOf,
} from "@/testing/support/readings";
import { expectOk } from "@/testing/support/result";

// Monday 26 October, 09:00 in Vietnam
const monday = "2026-10-26T02:00:00Z";

function anApp(reader: MessageReader | undefined, time = testClock(monday)) {
  return testApp(time.clock, reader);
}

async function read(app: App, note: LiveNote, again = false) {
  return app.readNote({ by: await theAuthor(), noteId: note.id, again });
}

async function answer(
  app: App,
  note: LiveNote,
  given: Parameters<App["answerReading"]>[0]["answer"],
) {
  return app.answerReading({ by: await theAuthor(), noteId: note.id, answer: given });
}

async function stateOf(app: App, note: LiveNote) {
  return (await app.readingStates([note.captureId])).get(note.captureId);
}

function defined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected a value");
  }

  return value;
}

describe("reading a note into an order", () => {
  it("given a customer named as the list has them, when read, then the order is placed on the message's day, with its capture, and a line total split per unit", async () => {
    const text = "bán 2 hộp thuốc tê cho nk Hướng Dương 500k";
    const app = anApp(
      readerOf({ [text]: anOrderReading("nk Hướng Dương", [aLine("thuốc tê", 2, "500k")]) }),
    );
    const customer = await aCustomer(app, "Nha khoa Hướng Dương");
    const note = await recordNote(app, text);

    const settled = expectOk(await read(app, note));

    expect(settled.interpretation).toMatchObject({ outcome: "order", reader: replayReader });
    const order = defined(await app.getOrder(defined(settled.order).order.id));
    expect(order).toMatchObject({
      customerId: customer.id,
      captureId: note.captureId,
      lines: [{ quantity: 2, unitPrice: 250_000 }],
    });
    expect(order.orderedOn.toString()).toBe("2026-10-26");
    expect(await stateOf(app, note)).toMatchObject({
      kind: "order",
      order: { customerName: "Nha khoa Hướng Dương", total: 500_000 },
    });
  });

  it("given products sold before, when an amount could be a unit price or a total, then the one nearer the last price wins; a line with no price takes its last one, or nothing", async () => {
    const text = "50 hộp khẩu trang 30k, 3 kim, găng tay cho nk Hướng Dương";
    const app = anApp(
      readerOf({
        [text]: anOrderReading("nk Hướng Dương", [
          aLine("khẩu trang", 50, "30k"),
          aLine("kim", 3, null),
          aLine("găng tay", null, null),
        ]),
      }),
    );
    const customer = await aCustomer(app, "Nha khoa Hướng Dương");
    const earlier = await anOrder(app, customer, [
      line("Khẩu trang", 10, 30_000),
      line("Găng tay", 2, 5_000),
    ]);
    const note = await recordNote(app, text);

    const settled = expectOk(await read(app, note));

    expect(defined(settled.order).order.lines).toEqual([
      { productId: earlier.lines[0]?.productId, quantity: 50, unitPrice: 30_000 },
      { productId: expect.any(String), quantity: 3, unitPrice: 0 },
      { productId: earlier.lines[1]?.productId, quantity: 1, unitPrice: 5_000 },
    ]);
  });

  it("given a name that is exactly one customer's, when others hold its words too, then it is that customer", async () => {
    const text = "bán 1 hộp kim cho nk Lan 100k";
    const app = anApp(readerOf({ [text]: anOrderReading("nk Lan", [aLine("kim", 1, "100k")]) }));
    const exact = await aCustomer(app, "Nha khoa Lan");
    await aCustomer(app, "Lan Anh");
    const note = await recordNote(app, text);

    const settled = expectOk(await read(app, note));

    expect(settled.order?.order.customerId).toBe(exact.id);
  });

  it("given a product name too long for the list, when read, then nothing is made and the failure is kept as refused", async () => {
    const text = "bán một món tên rất dài";
    const app = anApp(
      readerOf({ [text]: anOrderReading("Hướng Dương", [aLine("x".repeat(150), 1, "1k")]) }),
    );
    await aCustomer(app, "Hướng Dương");
    const note = await recordNote(app, text);

    const settled = expectOk(await read(app, note));

    expect(settled.interpretation).toMatchObject({ outcome: "failed", failure: "refused" });
    expect(settled.order).toBeUndefined();
    expect(await stateOf(app, note)).toEqual({ kind: "failed", failure: "refused" });
  });

  it("given an order reading with no lines, when read, then it is kept as a note", async () => {
    const text = "chị Lan hỏi giá";
    const app = anApp(readerOf({ [text]: anOrderReading("chị Lan", []) }));
    const note = await recordNote(app, text);

    expect(expectOk(await read(app, note)).interpretation).toMatchObject({ outcome: "note" });
  });
});

describe("asking whose order it is", () => {
  const text = "bán 2 hộp kim cho chị Lan 200k";
  const reading = anOrderReading("chị Lan", [aLine("kim", 2, "200k")]);

  it("given a name two customers hold, when read, then nothing is made and both are offered; answered, the order is placed for the one chosen, once", async () => {
    const app = anApp(readerOf({ [text]: reading }));
    const lanAnh = await aCustomer(app, "Lan Anh");
    const phuongLan = await aCustomer(app, "Phương Lan");
    const note = await recordNote(app, text);

    const asked = expectOk(await read(app, note));
    expect(asked.interpretation).toMatchObject({ outcome: "unsure", question: "ambiguous" });
    expect(asked.order).toBeUndefined();
    expect(await stateOf(app, note)).toMatchObject({
      kind: "unsure",
      written: "chị Lan",
      candidates: [{ id: lanAnh.id }, { id: phuongLan.id }],
    });
    expect(await read(app, note, true)).toEqual(err("already_read"));

    const chosen = { kind: "customer", customerId: phuongLan.id } as const;
    const settled = expectOk(await answer(app, note, chosen));

    expect(settled.interpretation).toMatchObject({
      outcome: "order",
      reader: { model: "person" },
    });
    expect(settled.order?.order).toMatchObject({
      customerId: phuongLan.id,
      captureId: note.captureId,
    });
    expect(await answer(app, note, chosen)).toEqual(err("not_asked"));
  });

  it("given a name nobody has, when answered with a new customer, then the customer is added as written, with the order", async () => {
    const app = anApp(readerOf({ [text]: reading }));
    const note = await recordNote(app, text);
    expect(await stateOf(app, note)).toEqual({ kind: "unread" });

    expect(expectOk(await read(app, note)).interpretation).toMatchObject({
      outcome: "unsure",
      question: "unknown",
      candidates: [],
    });
    const settled = expectOk(await answer(app, note, { kind: "new_customer" }));

    const customer = defined(settled.customer);
    expect(await app.getCustomer(customer.id)).toMatchObject({ name: "chị Lan", status: "active" });
    expect(settled.order?.order.customerId).toBe(customer.id);
  });

  it("given a customer hidden since they were offered, when chosen, then it is refused and still asked", async () => {
    const app = anApp(readerOf({ [text]: reading }));
    const lanAnh = await aCustomer(app, "Lan Anh");
    await aCustomer(app, "Phương Lan");
    const note = await recordNote(app, text);
    expectOk(await read(app, note));
    expectOk(await app.archiveCustomer(changeOf(lanAnh, await theAuthor())));

    expect(await answer(app, note, { kind: "customer", customerId: lanAnh.id })).toEqual(
      err("customer_unavailable"),
    );
    expect(await stateOf(app, note)).toMatchObject({
      kind: "unsure",
      candidates: [{ name: "Phương Lan" }],
    });
  });

  it("given a question, when answered that it is not an order, then the note stays a note and shows nothing", async () => {
    const app = anApp(readerOf({ [text]: reading }));
    const note = await recordNote(app, text);
    expectOk(await read(app, note));

    const settled = expectOk(await answer(app, note, { kind: "dismiss" }));

    expect(settled.interpretation).toMatchObject({
      outcome: "note",
      reader: { model: "person" },
    });
    expect(await stateOf(app, note)).toBeUndefined();
  });

  it("given a note never asked about, when answered, then it is refused", async () => {
    const app = anApp(readerOf({}));
    const note = await recordNote(app, text);

    expect(await answer(app, note, { kind: "dismiss" })).toEqual(err("not_asked"));
  });
});

describe("reading a note into a reminder", () => {
  const text = "thứ 3 gọi nk Hướng Dương";

  it.each([
    ["on the day it names", "2026-10-27", "2026-10-27"],
    ["on the day it was written, for a day already past", "2026-10-20", "2026-10-26"],
    ["on the day it was written, for a day that does not exist", "2026-02-30", "2026-10-26"],
  ])("given a reminder, when read, then it is due %s", async (_, dueOn, expected) => {
    const app = anApp(readerOf({ [text]: aReminderReading("nk Hướng Dương", "thứ 3", dueOn) }));
    const customer = await aCustomer(app, "Nha khoa Hướng Dương");
    const note = await recordNote(app, text);

    const reminder = defined(expectOk(await read(app, note)).reminder);

    expect(reminder).toMatchObject({ text, customerId: customer.id, captureId: note.captureId });
    expect(reminder.dueOn.toString()).toBe(expected);
    expect(await stateOf(app, note)).toMatchObject({ kind: "reminder" });
  });

  it("given a name two customers hold, when read as a reminder, then it is made without a customer rather than asked", async () => {
    const app = anApp(readerOf({ [text]: aReminderReading("chị Lan", "thứ 3", "2026-10-27") }));
    await aCustomer(app, "Lan Anh");
    await aCustomer(app, "Phương Lan");
    const note = await recordNote(app, text);

    const reminder = defined(expectOk(await read(app, note)).reminder);

    expect(reminder.customerId).toBeUndefined();
  });
});

describe("reading once", () => {
  const text = "bán 1 hộp kim cho nk Hướng Dương 100k";
  const reading = anOrderReading("nk Hướng Dương", [aLine("kim", 1, "100k")]);

  it("given a note read as a note, when read again, then it is refused", async () => {
    const plain = "nhớ mang catalogue";
    const app = anApp(readerOf({ [plain]: aReading({}) }));
    const note = await recordNote(app, plain);

    expect(expectOk(await read(app, note)).interpretation).toMatchObject({ outcome: "note" });
    expect(await read(app, note, true)).toEqual(err("already_read"));
    expect(await stateOf(app, note)).toBeUndefined();
  });

  it("given a failed reading, when read again, then it is read; without asking for it again, it is not", async () => {
    let calls = 0;
    const failsOnce: MessageReader = {
      async read() {
        calls += 1;
        return calls === 1
          ? err({ failure: "quota", reader: replayReader, neurons: undefined })
          : ok({ reading, reader: replayReader, neurons: 7.5 });
      },
    };
    const app = anApp(failsOnce);
    await aCustomer(app, "Nha khoa Hướng Dương");
    const note = await recordNote(app, text);

    expect(expectOk(await read(app, note)).interpretation).toMatchObject({
      outcome: "failed",
      failure: "quota",
    });
    expect(await stateOf(app, note)).toEqual({ kind: "failed", failure: "quota" });
    expect(await read(app, note)).toEqual(err("already_read"));

    const settled = expectOk(await read(app, note, true));

    expect(settled.interpretation).toMatchObject({ outcome: "order", neurons: 7.5 });
    expect(calls).toBe(2);
  });

  it("given two readings of one note at once, when both finish, then one order is made and the other is refused", async () => {
    const app = anApp(readerOf({ [text]: reading }));
    const customer = await aCustomer(app, "Nha khoa Hướng Dương");
    const note = await recordNote(app, text);

    const both = await Promise.all([read(app, note), read(app, note)]);

    expect(both.filter((result) => result.ok)).toHaveLength(1);
    expect(both.filter((result) => !result.ok)).toEqual([err("already_read")]);
    expect(await app.customerAccount(customer.id)).toMatchObject({ orderCount: 1 });
  });

  it("given a note sent late one evening and edited the next day, when read, then the message as sent is read, as of the day it was sent", async () => {
    const time = testClock("2026-10-25T16:30:00Z");
    const app = anApp(readerOf({ [text]: reading }), time);
    await aCustomer(app, "Nha khoa Hướng Dương");
    const note = await recordNote(app, text);
    time.setTo(monday);
    expectOk(
      await app.editNote({ ...changeOf(note, await theAuthor()), content: content("đã sửa") }),
    );

    const settled = expectOk(await read(app, note));

    expect(settled.order?.order.orderedOn.toString()).toBe("2026-10-25");
  });
});

describe("where notes cannot be read", () => {
  it("given no reader, when a note is read, then it is refused and the app says it cannot read", async () => {
    const app = anApp(undefined);
    const note = await recordNote(app, "bán 1 hộp kim");

    expect(app.canRead()).toBe(false);
    expect(await read(app, note)).toEqual(err("reader_unavailable"));
  });

  it("given a deleted note, when read, then it is refused", async () => {
    const app = anApp(readerOf({}));
    const note = await recordNote(app, "bán 1 hộp kim");
    expectOk(await app.deleteNote(changeOf(note, await theAuthor())));

    expect(await read(app, note)).toEqual(err("note_unavailable"));
  });
});

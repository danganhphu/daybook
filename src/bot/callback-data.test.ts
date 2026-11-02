import { describe, expect, it } from "vitest";

import { noteIdSchema } from "@/features/notes/domain/note";
import { orderIdSchema } from "@/features/orders/domain/order";
import { reminderIdSchema } from "@/features/reminders/domain/reminder";
import { versionSchema } from "@/shared/domain/audit";

import { commandIn } from "./bot-commands";
import {
  callbackData,
  callbackDataMaxBytes,
  parseCallbackData,
  type CallbackAction,
} from "./callback-data";

// The longest ids and versions a card can carry
const order = orderIdSchema.parse("019a3f2e-7c1b-7d4e-9f00-123456789abc");
const reminder = reminderIdSchema.parse("019a3f2e-7c1b-7d4e-9f00-123456789abd");
const note = noteIdSchema.parse("019a3f2e-7c1b-7d4e-9f00-123456789abe");
const version = versionSchema.parse(999_999);

const every: ReadonlyArray<CallbackAction> = [
  { kind: "undo_order", id: order, version },
  { kind: "restore_order", id: order, version },
  { kind: "undo_reminder", id: reminder, version },
  { kind: "restore_reminder", id: reminder, version },
  { kind: "complete_reminder", id: reminder, version },
  { kind: "ask_delete_note", id: note, version },
  { kind: "delete_note", id: note, version },
  { kind: "restore_note", id: note, version },
  { kind: "show_note", id: note },
  { kind: "answer_customer", id: note, candidate: 3, customerTail: "56789abe" },
  { kind: "answer_new_customer", id: note },
  { kind: "answer_not_order", id: note },
  { kind: "read_again", id: note },
];

describe("callback data", () => {
  it.each(every)(
    "given $kind, when written, then it fits Telegram's 64 bytes and reads back the same",
    (action) => {
      const data = callbackData(action);

      expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(callbackDataMaxBytes);
      expect(parseCallbackData(data)).toEqual(action);
    },
  );

  it.each([
    "",
    "uo",
    "uo:not-an-id:1",
    `uo:${order}:0`,
    `uo:${order}:1.5`,
    `uo:${order}:1:extra`,
    `ac:${note}:-1:56789abe`,
    `ac:${note}:1:019a-3f2`,
    `ac:${note}:1:<script>`,
    "zz:anything",
  ])("given %j, which the bot never writes, when read, then it means nothing", (data) => {
    expect(parseCallbackData(data)).toBeUndefined();
  });
});

describe("commandIn", () => {
  it.each([
    ["/start abc_DEF-1", { name: "start", argument: "abc_DEF-1" }],
    ["/today@daybook_bot", { name: "today", argument: "" }],
    ["  /HELP  ", { name: "help", argument: "" }],
    ["/nope", { name: undefined, argument: "" }],
  ])("given %j, when read, then it is that command", (text, call) => {
    expect(commandIn(text)).toEqual(call);
  });

  it.each(["thuốc tê x2", "a /today", "/ today"])(
    "given %j, when read, then it is a note",
    (text) => {
      expect(commandIn(text)).toBeUndefined();
    },
  );
});

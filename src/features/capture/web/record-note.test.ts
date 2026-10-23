import { describe, expect, it } from "vitest";

import { todaysNotes } from "@/features/notes/web/commands";
import { testApp, testClock, theAuthor } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

import { recordNote } from "./record-note";

describe("recordNote", () => {
  it("given the user's words, when recorded, then they come back as a note on the user's clock", async () => {
    const app = testApp(testClock("2026-10-19T02:12:00Z").clock);

    const view = expectOk(
      await recordNote(app, await theAuthor(), "Giao 2 hộp thuốc tê\nthu 850.000đ"),
    );

    expect(view.content).toBe("Giao 2 hộp thuốc tê\nthu 850.000đ");
    expect(view.time).toBe("09:12");
  });

  it("given only spaces, when recorded, then it is refused with the reason and nothing is stored", async () => {
    const app = testApp(testClock("2026-10-19T02:12:00Z").clock);

    expect(await recordNote(app, await theAuthor(), "   ")).toEqual({
      ok: false,
      error: "Chưa có nội dung",
    });
    expect((await todaysNotes(app)).notes).toEqual([]);
  });

  it("given more than 4000 characters, when recorded, then it is refused with the limit", async () => {
    const app = testApp(testClock("2026-10-19T02:12:00Z").clock);

    expect(await recordNote(app, await theAuthor(), "x".repeat(4001))).toEqual({
      ok: false,
      error: "Tối đa 4000 ký tự",
    });
  });
});

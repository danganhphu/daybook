import { describe, expect, it } from "vitest";

import { noteIdSchema, type NoteId } from "@/features/notes/domain/note";
import type { AccountId } from "@/shared/domain/account-id";
import { rows, seedAccount } from "@/testing/support/access";
import { content, testApp, testClock } from "@/testing/support/app";
import { testJobs } from "@/testing/support/notifications";

import type { ReplyJob } from "./reply-job";

function replyTo(accountId: AccountId, noteId: NoteId): ReplyJob {
  return { kind: "reply", accountId, noteId, chatId: 70_000_001, messageId: 42, again: false };
}

function bell() {
  return rows<{ subject: string; ref: string; title: string; path: string }>(
    "select subject, ref, title, path from inbox_item",
  );
}

describe("reportUnanswered", () => {
  it("given yesterday's message the bot never answered, when reported twice, then its sender finds it once in the bell, opening that day", async () => {
    const time = testClock("2026-10-28T03:00:00Z");
    const lan = await seedAccount(time.clock);
    const note = await testApp(time.clock).recordCapture({
      content: content("2 hộp kim cho Lan Anh"),
      source: "web",
      authorId: lan.id,
    });
    time.setTo("2026-10-29T01:00:00Z");
    const jobs = testJobs(time.clock, undefined);

    await jobs.reportUnanswered(replyTo(lan.id, note.id));
    await jobs.reportUnanswered(replyTo(lan.id, note.id));

    expect(await bell()).toEqual([
      {
        subject: "reply_failed",
        ref: note.id,
        title: "Bot chưa trả lời được một tin nhắn",
        path: "/days/2026-10-28",
      },
    ]);
  });

  it("given a message whose note is gone, when reported, then the bell opens today", async () => {
    const time = testClock("2026-10-29T01:00:00Z");
    const lan = await seedAccount(time.clock);
    const gone = noteIdSchema.parse("019a0000-0000-7000-8000-0000000000f1");

    await testJobs(time.clock, undefined).reportUnanswered(replyTo(lan.id, gone));

    expect((await bell()).map((item) => item.path)).toEqual(["/"]);
  });
});

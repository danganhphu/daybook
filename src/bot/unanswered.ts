import type { NoteRepository } from "@/features/notes/domain/note-repository";
import type { InboxWrites } from "@/features/notifications/application/notification-writes";
import * as InboxItems from "@/features/notifications/domain/inbox-item";
import type { Clock } from "@/shared/application/clock";
import type { UnitOfWork } from "@/shared/application/unit-of-work";
import { vietnamDate } from "@/shared/domain/vietnam-day";
import { dayPath } from "@/shared/web/routes";

import { botCopy } from "./bot-copy";
import type { ReplyJob } from "./reply-job";

export type UnansweredDeps = {
  readonly clock: Clock;
  readonly notes: Pick<NoteRepository, "get">;
  readonly startUnitOfWork: () => UnitOfWork<{ readonly inbox: InboxWrites }>;
};

// A message the bot could not answer after every retry. Its note is in the book all the same; whoever sent it is told
// in the bell, which opens the day it is on. Once per message: the list keeps an item once.
export async function reportUnanswered(deps: UnansweredDeps, job: ReplyJob): Promise<void> {
  const now = deps.clock();
  const today = vietnamDate(now);
  const note = await deps.notes.get(job.noteId);
  const day = note === undefined ? today : vietnamDate(note.audit.createdAt);

  const work = deps.startUnitOfWork();
  work.inbox.add(
    InboxItems.create(
      {
        accountId: job.accountId,
        subject: "reply_failed",
        ref: job.noteId,
        title: botCopy.unansweredTitle,
        body: botCopy.unansweredBody,
        path: dayPath(day.toString(), today.toString()),
      },
      now,
    ),
  );
  await work.commit();
}

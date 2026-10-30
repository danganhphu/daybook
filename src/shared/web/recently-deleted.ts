import { recentlyDeletedDays } from "@/shared/domain/recently-deleted";

// How far back "Đã xoá gần đây" lists, and how many of each kind. Older deletions leave the database by the daily
// run (ADR 0017).
export const recentlyDeleted = { days: recentlyDeletedDays, limit: 50 } as const;

export const recentlyDeletedCopy = {
  title: "Đã xoá gần đây",
  window: `Tự xoá vĩnh viễn sau ${recentlyDeleted.days} ngày`,
  empty: `Không có gì bị xoá trong ${recentlyDeleted.days} ngày qua`,
  restored: "Đã khôi phục",
  purged: "Đã xoá vĩnh viễn",
  // Under a delete's question, for anything that goes to the trash
  canRestore: `Vẫn khôi phục được trong Đã xoá gần đây ${recentlyDeleted.days} ngày.`,
  // Under a question that deletes for good
  cannotRestore: "Không khôi phục được nữa.",
} as const;

// "Xoá ghi chú này?"
export function deleteQuestion(what: string): string {
  return `Xoá ${what} này?`;
}

// A deleted thing as "Đã xoá gần đây" lists it, with what restoring it needs
export type DeletedRowView = {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  // What it was, then "Xoá 26/10 (Lan)"
  readonly detail: string;
  // Epoch milliseconds, for one list newest first across every kind
  readonly deletedAt: number;
};

// How far back "Đã xoá gần đây" lists, and how many of each kind. Older deletions stay in the book - deletes are soft
// and nothing is purged - they are only no longer listed.
export const recentlyDeleted = { days: 30, limit: 50 } as const;

export const recentlyDeletedCopy = {
  title: "Đã xoá gần đây",
  window: `Những gì xoá trong ${recentlyDeleted.days} ngày qua`,
  empty: `Không có gì bị xoá trong ${recentlyDeleted.days} ngày qua`,
  orders: "Đơn hàng",
  notes: "Ghi chú",
  reminders: "Việc cần nhắc",
  restored: "Đã khôi phục",
} as const;

// A deleted order, note or reminder as the list shows it, with what restoring it needs
export type DeletedRowView = {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  // What it was, then "Xoá 26/10 (Lan)"
  readonly detail: string;
};

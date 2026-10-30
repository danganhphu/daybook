export type ReminderError =
  | "reminder_not_found"
  | "reminder_changed_elsewhere"
  | "reminder_deleted"
  | "reminder_done"
  | "reminder_open"
  | "reminder_not_deleted"
  | "reminder_deleted_with_customer"
  | "customer_unavailable"
  | "note_unavailable";

export const reminderErrorMessages = {
  reminder_not_found: "Không tìm thấy việc này nữa.",
  reminder_changed_elsewhere: "Việc này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  reminder_deleted: "Việc này đã bị xoá.",
  reminder_done: "Việc này đã xong rồi.",
  reminder_open: "Việc này chưa xong.",
  reminder_not_deleted: "Việc này vẫn còn, không cần khôi phục.",
  reminder_deleted_with_customer:
    "Việc này bị xoá cùng khách. Khôi phục khách trong Đã xoá gần đây.",
  customer_unavailable: "Khách này không còn trong danh sách.",
  note_unavailable: "Không tìm thấy ghi chú này nữa.",
} as const satisfies Record<ReminderError, string>;

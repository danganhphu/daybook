// Why one thing in the trash could not be restored or deleted for good, with the sentence the user reads
export type TrashError =
  | "trash_not_found"
  | "trash_changed_elsewhere"
  | "trash_not_deleted"
  | "trash_customer_deleted"
  | "trash_name_taken";

export const trashErrorMessages = {
  trash_not_found: "Không còn trong Đã xoá gần đây.",
  trash_changed_elsewhere: "Vừa có thay đổi ở máy khác. Xem bản mới rồi thử lại.",
  trash_not_deleted: "Đã được khôi phục rồi.",
  trash_customer_deleted: "Khách của mục này cũng đang bị xoá. Khôi phục khách trước.",
  trash_name_taken: "Đang có một mục khác cùng tên.",
} as const satisfies Record<TrashError, string>;

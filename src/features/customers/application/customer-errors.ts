// Every way a customer or customer-kind use case is known to fail, with the sentence the user reads
export type CustomerError =
  | "customer_not_found"
  | "customer_changed_elsewhere"
  | "customer_archived"
  | "customer_not_archived"
  | "customer_merged"
  | "customer_deleted"
  | "customer_not_deleted"
  | "alias_taken"
  | "alias_not_found"
  | "kind_not_found"
  | "kind_changed_elsewhere"
  | "kind_name_taken"
  | "kind_archived"
  | "kind_not_archived"
  | "kind_deleted"
  | "kind_not_deleted";

export const customerErrorMessages = {
  customer_not_found: "Không tìm thấy khách này nữa.",
  customer_changed_elsewhere: "Khách này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  customer_archived: "Khách này đã ẩn rồi.",
  customer_not_archived: "Khách này vẫn đang hiện.",
  customer_merged: "Khách này đã gộp vào khách khác.",
  customer_deleted: "Khách này đã xoá rồi.",
  customer_not_deleted: "Khách này đã khôi phục rồi.",
  alias_taken: "Khách này đã có tên này rồi.",
  alias_not_found: "Không tìm thấy tên này nữa.",
  kind_not_found: "Không tìm thấy loại khách này nữa.",
  kind_changed_elsewhere: "Loại khách này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  kind_name_taken: "Đã có loại khách tên này.",
  kind_archived: "Loại khách này đã ẩn rồi.",
  kind_not_archived: "Loại khách này vẫn đang hiện.",
  kind_deleted: "Loại khách này đã xoá rồi.",
  kind_not_deleted: "Loại khách này đã khôi phục rồi.",
} as const satisfies Record<CustomerError, string>;

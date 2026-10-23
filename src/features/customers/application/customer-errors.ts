// Every way a customer or customer-kind use case is known to fail, with the sentence the user reads
export type CustomerError =
  | "customer_not_found"
  | "customer_changed_elsewhere"
  | "customer_archived"
  | "customer_not_archived"
  | "kind_not_found"
  | "kind_changed_elsewhere"
  | "kind_name_taken"
  | "kind_archived"
  | "kind_not_archived";

export const customerErrorMessages = {
  customer_not_found: "Không tìm thấy khách này nữa.",
  customer_changed_elsewhere: "Khách này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  customer_archived: "Khách này đã ẩn rồi.",
  customer_not_archived: "Khách này vẫn đang hiện.",
  kind_not_found: "Không tìm thấy loại khách này nữa.",
  kind_changed_elsewhere: "Loại khách này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  kind_name_taken: "Đã có loại khách tên này.",
  kind_archived: "Loại khách này đã ẩn rồi.",
  kind_not_archived: "Loại khách này vẫn đang hiện.",
} as const satisfies Record<CustomerError, string>;

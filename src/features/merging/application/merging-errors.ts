// Every way a merge is known to fail, with the sentence the user reads
export type MergeError =
  | "merge_into_itself"
  | "customer_not_found"
  | "customer_changed_elsewhere"
  | "customer_merged"
  | "customer_kept_unavailable"
  | "product_not_found"
  | "product_changed_elsewhere"
  | "product_merged"
  | "product_kept_unavailable";

export const mergeErrorMessages = {
  merge_into_itself: "Chọn một bản khác để gộp vào.",
  customer_not_found: "Không tìm thấy khách này nữa.",
  customer_changed_elsewhere: "Khách vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  customer_merged: "Khách này đã gộp vào khách khác.",
  customer_kept_unavailable: "Khách giữ lại không còn trong danh sách.",
  product_not_found: "Không tìm thấy sản phẩm này nữa.",
  product_changed_elsewhere: "Sản phẩm vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  product_merged: "Sản phẩm này đã gộp vào sản phẩm khác.",
  product_kept_unavailable: "Sản phẩm giữ lại không còn trong danh sách.",
} as const satisfies Record<MergeError, string>;

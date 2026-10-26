// Every way a product use case is known to fail, with the sentence the user reads
export type ProductError =
  | "product_not_found"
  | "product_changed_elsewhere"
  | "product_name_taken"
  | "product_archived"
  | "product_not_archived"
  | "product_merged"
  | "alias_taken"
  | "alias_not_found";

export const productErrorMessages = {
  product_not_found: "Không tìm thấy sản phẩm này nữa.",
  product_changed_elsewhere: "Sản phẩm này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  product_name_taken: "Đã có sản phẩm tên này rồi.",
  product_archived: "Sản phẩm này đã ẩn rồi.",
  product_not_archived: "Sản phẩm này vẫn đang hiện.",
  product_merged: "Sản phẩm này đã gộp vào sản phẩm khác.",
  alias_taken: "Tên này đã dùng cho một sản phẩm rồi.",
  alias_not_found: "Không tìm thấy tên này nữa.",
} as const satisfies Record<ProductError, string>;

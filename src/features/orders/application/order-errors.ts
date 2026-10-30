import type { OrderRefusal } from "@/features/orders/domain/order";

// Every way an order use case is known to fail, with the sentence the user reads
export type OrderError =
  | OrderRefusal
  | "order_not_found"
  | "order_changed_elsewhere"
  | "customer_unavailable"
  | "product_not_found";

export const orderErrorMessages = {
  order_not_found: "Không tìm thấy đơn này nữa.",
  order_changed_elsewhere: "Đơn này vừa được sửa ở máy khác. Xem bản mới rồi thử lại.",
  order_deleted: "Đơn này đã bị xoá.",
  order_not_deleted: "Đơn này vẫn còn, không cần khôi phục.",
  order_deleted_with_customer: "Đơn này bị xoá cùng khách. Khôi phục khách trong Đã xoá gần đây.",
  order_too_large: "Số tiền của đơn lớn quá, kiểm tra lại số lượng và giá.",
  total_below_paid: "Tổng đơn không thể ít hơn số đã thu.",
  payment_exceeds_owed: "Số tiền thu nhiều hơn số còn nợ.",
  payment_not_found: "Không tìm thấy lần thu tiền này nữa.",
  delivered_before_ordered: "Ngày giao không thể trước ngày đặt.",
  customer_unavailable: "Khách này không còn trong danh sách.",
  product_not_found: "Không tìm thấy sản phẩm này nữa.",
} as const satisfies Record<OrderError, string>;

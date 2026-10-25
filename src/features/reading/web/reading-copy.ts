export const readingCopy = {
  read: "Đọc tin này",
  reading: "Đang đọc tin...",
  orderMade: "Đã ghi đơn",
  reminderMade: "Đã đặt nhắc",
  whose: "Đơn này của khách nào?",
  pickCustomer: "Chọn khách",
  otherCustomer: "Khách khác",
  notAnOrder: "Không phải đơn",
  failed: "Chưa đọc được tin này.",
  // The free allowance starts again at 00:00 UTC
  quota: "Hôm nay hết lượt đọc tin. Từ 7 giờ sáng mai đọc lại được.",
  refused: "Chưa ghi được đơn từ tin này.",
  readAgain: "Đọc lại",
  unpriced: "chưa đủ giá",
  pickTitle: "Chọn khách cho đơn",
  customer: "Khách",
  noCustomer: "Không có khách này trong danh sách.",
} as const;

export function unknownCustomer(written: string): string {
  return `Chưa có khách "${written}" trong danh sách.`;
}

export function addCustomerNamed(written: string): string {
  return `Thêm khách "${written}"`;
}

// "Thuốc tê x2", or the name alone for one
export function lineText(productName: string, quantity: number): string {
  return quantity === 1 ? productName : `${productName} x${quantity}`;
}

// What the product screens say, in one place
export const productsCopy = {
  title: "Sản phẩm",
  add: "Thêm sản phẩm",
  name: "Tên sản phẩm",
  rename: "Đổi tên",
  search: "Tìm sản phẩm",
  searchPlaceholder: "Tên sản phẩm",
  hidden: "Sản phẩm đã ẩn",
  hide: "Ẩn sản phẩm",
  show: "Hiện lại",
  addedToast: "Đã thêm sản phẩm",
  renamedToast: "Đã đổi tên sản phẩm",
  hiddenToast: "Đã ẩn sản phẩm",
  shownToast: "Đã hiện lại sản phẩm",
  isHidden: "Sản phẩm này đang ẩn: không hiện khi ghi đơn, đơn cũ vẫn giữ.",
  lastPrice: "Giá gần nhất",
  orderCount: "Số đơn",
  orders: "Đơn có sản phẩm này",
  noOrders: "Chưa có đơn nào có sản phẩm này",
  empty: "Chưa có sản phẩm nào",
  emptyHint: "Sản phẩm tự có khi ghi đơn, hoặc thêm ở đây.",
  notFound: "Không tìm thấy sản phẩm nào",
  otherNamesFooter: "Đơn hay tin nhắn ghi tên nào ở đây cũng là sản phẩm này.",
} as const;

// "12 đơn", under a product's name in the list
export function orderCountText(count: number): string {
  return `${count} đơn`;
}

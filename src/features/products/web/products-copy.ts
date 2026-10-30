import { productsListLimit } from "@/features/products/application/list-products";

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
  // One of them, mid-sentence: "Xoá sản phẩm này?"
  one: "sản phẩm",
  remove: "Xoá sản phẩm",
  deleted: "Đã xoá sản phẩm",
  cannotDelete: "Không xoá được sản phẩm này",
  isDeleted: "Sản phẩm này đang ở Đã xoá gần đây.",
  isHidden: "Sản phẩm này đang ẩn: không hiện khi ghi đơn, đơn cũ vẫn giữ.",
  lastPrice: "Giá gần nhất",
  orderCount: "Số đơn",
  orders: "Đơn có sản phẩm này",
  noOrders: "Chưa có đơn nào có sản phẩm này",
  empty: "Chưa có sản phẩm nào",
  emptyHint: "Sản phẩm tự có khi ghi đơn, hoặc thêm ở đây.",
  notFound: "Không tìm thấy sản phẩm nào",
  // Under a list cut at its limit, so it never just stops
  more: `Chỉ hiện ${productsListLimit} sản phẩm đầu. Tìm tên để thấy sản phẩm khác.`,
  otherNamesFooter: "Đơn hay tin nhắn ghi tên nào ở đây cũng là sản phẩm này.",
} as const;

// "12 đơn", under a product's name in the list
export function orderCountText(count: number): string {
  return `${count} đơn`;
}

// Why one any order names is hidden instead
export function inOrdersText(count: number): string {
  return `Sản phẩm này có trong ${orderCountText(count)}. Ẩn để các đơn cũ vẫn giữ tên.`;
}

// The same, for one hidden already
export function inOrdersHiddenText(count: number): string {
  return `Sản phẩm này có trong ${orderCountText(count)} nên không xoá được. Sản phẩm đã ẩn rồi.`;
}

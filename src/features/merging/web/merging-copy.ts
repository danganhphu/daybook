// What the merge dialogs say, in one place
export const mergingCopy = {
  mergeCustomer: "Gộp vào khách khác",
  mergeProduct: "Gộp vào sản phẩm khác",
  pickCustomer: "Gộp vào khách nào?",
  pickProduct: "Gộp vào sản phẩm nào?",
  keptCustomer: "Khách giữ lại",
  keptProduct: "Sản phẩm giữ lại",
  noCustomer: "Không có khách này trong danh sách.",
  noProduct: "Không có sản phẩm này trong danh sách.",
  confirm: "Gộp",
  mergedCustomer: "Đã gộp khách",
  mergedProduct: "Đã gộp sản phẩm",
  customerIsMerged: "Khách này đã gộp vào khách khác.",
  productIsMerged: "Sản phẩm này đã gộp vào sản phẩm khác.",
  seeKept: "Xem bản giữ lại",
} as const;

export function pickCustomerHint(from: string): string {
  return `Đơn và việc cần nhắc của "${from}" sẽ chuyển sang khách được chọn.`;
}

export function pickProductHint(from: string): string {
  return `Đơn có "${from}" sẽ chuyển sang sản phẩm được chọn.`;
}

export function confirmTitle(from: string, into: string): string {
  return `Gộp "${from}" vào "${into}"?`;
}

export function confirmCustomerMerge(
  from: string,
  into: string,
  moved: { readonly orders: number; readonly reminders: number },
): string {
  return `${moved.orders} đơn và ${moved.reminders} việc cần nhắc sẽ chuyển sang "${into}". "${from}" thành tên khác của khách này. Không hoàn tác được.`;
}

export function confirmProductMerge(from: string, into: string, orders: number): string {
  return `${orders} đơn sẽ chuyển sang "${into}". "${from}" thành tên khác của sản phẩm này. Không hoàn tác được.`;
}

import type { BucketKind, PeriodError, PeriodKind } from "@/features/reports/domain/report-period";

export const reportsCopy = {
  title: "Báo cáo",
  periodChoice: "Kỳ báo cáo",
  periodKinds: {
    week: "Tuần",
    month: "Tháng",
    quarter: "Quý",
    year: "Năm",
    range: "Khoảng ngày",
  } satisfies Record<PeriodKind, string>,
  // "so với tháng trước"
  previousOfKind: {
    week: "tuần trước",
    month: "tháng trước",
    quarter: "quý trước",
    year: "năm trước",
    range: "kỳ trước",
  } satisfies Record<PeriodKind, string>,
  previous: "Kỳ trước",
  next: "Kỳ sau",
  noNext: "Kỳ sau chưa tới",
  sales: "Doanh số",
  received: "Thu về",
  owed: "Khách còn nợ",
  orders: "Số đơn",
  units: "Số lượng",
  overTime: {
    day: "Doanh số theo ngày",
    week: "Doanh số theo tuần",
    month: "Doanh số theo tháng",
  } satisfies Record<BucketKind, string>,
  buckets: {
    day: "Ngày",
    week: "Tuần",
    month: "Tháng",
  } satisfies Record<BucketKind, string>,
  byKind: "Theo loại khách",
  noKind: "Chưa có loại",
  products: "Sản phẩm bán chạy",
  customers: "Khách mua nhiều",
  quiet: "Khách lâu không đặt",
  allKinds: "Tất cả loại",
  filtering: "Đang lọc",
  from: "Từ ngày",
  to: "Đến ngày",
  show: "Xem",
  rangeErrors: {
    range_reversed: "Ngày bắt đầu phải trước ngày kết thúc",
    range_too_long: "Khoảng ngày dài nhất 2 năm",
  } satisfies Record<PeriodError, string>,
  rangeMissing: "Chọn ngày bắt đầu và ngày kết thúc",
  peak: "Cao nhất",
  table: "Xem dạng bảng",
} as const;

// "+12% so với tháng trước", "-5% so với tháng trước"
export function comparedWith(percent: number, previous: string): string {
  return percent === 0
    ? `Bằng ${previous}`
    : `${percent > 0 ? "+" : ""}${percent}% so với ${previous}`;
}

// "Gấp 48 lần tháng trước", where a percentage would read +4653%
export function timesOver(times: number, previous: string): string {
  return `Gấp ${times} lần ${previous}`;
}

export function emptyPeriod(title: string): string {
  return `${title} chưa có đơn nào`;
}

export function removeFilter(name: string): string {
  return `Bỏ lọc ${name}`;
}

export function orderCount(count: number): string {
  return `${count} đơn`;
}

// "28 ngày"
export function dayCount(days: number): string {
  return `${days} ngày`;
}

export function quietFooter(afterDays: number): string {
  return `Không có đơn nào trong ${afterDays} ngày qua`;
}

export function restOf(what: "products" | "customers", amount: string): string {
  return `${what === "products" ? "Các sản phẩm khác" : "Các khách khác"}: ${amount}`;
}

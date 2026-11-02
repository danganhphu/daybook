import type { Money } from "@/shared/domain/money";
import { moneySchema } from "@/shared/domain/money-schema";

export type LinePrice = {
  readonly unitPrice: Money;
  // The amount as written, when it is the line's total and does not divide by the quantity: "3 hộp 100k" is
  // 33.333đ a box and still 100.000đ in all
  readonly total: Money | undefined;
};

// What a written amount means for a line. When the message says it is for one unit, it is. Otherwise it is the line's
// total - unless the product sold before at a price nearer the amount itself, since "50 hộp khẩu trang 30k" cannot
// say which it is, and what was charged last time can.
export function linePriceOf(
  amount: Money,
  quantity: number,
  perUnit: boolean,
  lastPrice: Money | undefined,
): LinePrice {
  if (perUnit || quantity === 1) {
    return { unitPrice: amount, total: undefined };
  }
  const fromTotal = moneySchema.parse(Math.round(amount / quantity));
  const asTotal: LinePrice = {
    unitPrice: fromTotal,
    total: fromTotal * quantity === amount ? undefined : amount,
  };
  if (lastPrice === undefined) {
    return asTotal;
  }

  return Math.abs(amount - lastPrice) < Math.abs(fromTotal - lastPrice)
    ? { unitPrice: amount, total: undefined }
    : asTotal;
}

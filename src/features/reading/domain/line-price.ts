import { moneySchema, type Money } from "@/shared/domain/money";

// The unit price a written amount means for a line. When the message says it is for one unit, it is. Otherwise it
// is the line's total - unless the product sold before at a price nearer the amount itself, since "50 hộp khẩu
// trang 30k" cannot say which it is, and what was charged last time can.
export function unitPriceOf(
  amount: Money,
  quantity: number,
  perUnit: boolean,
  lastPrice: Money | undefined,
): Money {
  if (perUnit || quantity === 1) {
    return amount;
  }
  const fromTotal = moneySchema.parse(Math.round(amount / quantity));
  if (lastPrice === undefined) {
    return fromTotal;
  }

  return Math.abs(amount - lastPrice) < Math.abs(fromTotal - lastPrice) ? amount : fromTotal;
}

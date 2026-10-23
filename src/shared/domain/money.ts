import { z } from "zod";

// Vietnamese đồng have no fractions, so money is a whole number and sums are exact. A trillion đồng is far past any
// order two people take, and far inside a safe integer.
export const moneyMax = 1_000_000_000_000;

export const moneySchema = z
  .number({ error: "Số tiền phải là số" })
  .int({ error: "Số tiền không có số lẻ" })
  .min(0, { error: "Số tiền không âm" })
  .max(moneyMax, { error: "Số tiền quá lớn" })
  .brand<"Money">();

export type Money = z.infer<typeof moneySchema>;

export const zeroMoney = moneySchema.parse(0);

export function sum(amounts: Iterable<Money>): Money {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
  }

  return moneySchema.parse(total);
}

// The difference, never below zero: what is still owed once more than enough has come in is nothing
export function remaining(total: Money, paid: Money): Money {
  return moneySchema.parse(Math.max(total - paid, 0));
}

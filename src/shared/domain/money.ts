import type { z } from "zod";

import { err, ok, type Result } from "./result";

// Vietnamese đồng have no fractions, so money is a whole number and sums are exact. A trillion đồng is far past any
// order two people take, and far inside a safe integer.
export const moneyMax = 1_000_000_000_000;

export type Money = number & z.$brand<"Money">;

function isMoney(amount: number): amount is Money {
  return Number.isInteger(amount) && amount >= 0 && amount <= moneyMax;
}

export function parseMoney(amount: number): Result<Money, string> {
  if (isMoney(amount)) {
    return ok(amount);
  }
  if (!Number.isInteger(amount)) {
    return err("Số tiền không có số lẻ");
  }

  return err(amount < 0 ? "Số tiền không âm" : "Số tiền quá lớn");
}

// For sums the code makes itself: one out of range is a bug, not something the user typed
function money(amount: number): Money {
  const parsed = parseMoney(amount);
  if (!parsed.ok) {
    throw new RangeError(`${parsed.error}: ${amount}`);
  }

  return parsed.value;
}

export const zeroMoney = money(0);

export function sum(amounts: Iterable<Money>): Money {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
  }

  return money(total);
}

// The difference, never below zero: what is still owed once more than enough has come in is nothing
export function remaining(total: Money, paid: Money): Money {
  return money(Math.max(total - paid, 0));
}

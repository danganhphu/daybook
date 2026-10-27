import { describe, expect, it } from "vitest";

import { moneyMax, parseMoney, remaining, sum, zeroMoney } from "./money";
import { moneySchema } from "./money-schema";

const money = (amount: number) => moneySchema.parse(amount);

describe("parseMoney", () => {
  it.each([0, 850_000, moneyMax])("given %d đồng, when parsed, then it is money", (amount) => {
    expect(parseMoney(amount)).toEqual({ ok: true, value: amount });
  });

  it.each([
    [1.5, "Số tiền không có số lẻ"],
    [-1, "Số tiền không âm"],
    [moneyMax + 1, "Số tiền quá lớn"],
  ])("given %d, when parsed, then the reason is %j", (amount, reason) => {
    expect(parseMoney(amount)).toEqual({ ok: false, error: reason });
  });
});

describe("moneySchema", () => {
  it("given something that is not a number, when parsed, then it is refused as such", () => {
    expect(moneySchema.safeParse("850000").error?.issues[0]?.message).toBe("Số tiền phải là số");
  });

  it("given an amount the rule refuses, when parsed, then the issue carries the rule's sentence", () => {
    expect(moneySchema.safeParse(-1).error?.issues[0]?.message).toBe("Số tiền không âm");
  });
});

describe("sum and remaining", () => {
  it("given amounts, when summed, then the total is exact, and nothing is zero", () => {
    expect(sum([money(850_000), money(150_000)])).toBe(1_000_000);
    expect(sum([])).toBe(zeroMoney);
  });

  it("given more paid than owed, when what remains is asked, then it is nothing", () => {
    expect(remaining(money(100_000), money(150_000))).toBe(0);
  });

  it("given a sum past what money holds, when summed, then it is a bug and throws", () => {
    expect(() => sum([money(moneyMax), money(1)])).toThrow(RangeError);
  });
});

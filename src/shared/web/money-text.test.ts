import { describe, expect, it } from "vitest";

import { moneyMax } from "@/shared/domain/money";

import { compactMoneyText, groupedDigits, moneyText, parseMoneyInput } from "./money-text";

describe("moneyText", () => {
  it.each([
    [0, "0đ"],
    [5_000, "5.000đ"],
    [850_000, "850.000đ"],
    [1_250_000, "1.250.000đ"],
    [-50_000, "-50.000đ"],
  ])("given %d, when written, then it reads %s", (amount, text) => {
    expect(moneyText(amount)).toBe(text);
  });

  it("given an amount, when grouped for a field, then the đ is left off", () => {
    expect(groupedDigits(1_250_000)).toBe("1.250.000");
  });
});

describe("compactMoneyText", () => {
  it.each([
    [0, "0"],
    [500, "500đ"],
    [500_000, "500k"],
    [2_000_000, "2tr"],
    [2_500_000, "2,5tr"],
    [1_200_000_000, "1,2 tỷ"],
  ])("given %d, when shortened for an axis, then it reads %s", (amount, text) => {
    expect(compactMoneyText(amount)).toBe(text);
  });
});

describe("parseMoneyInput", () => {
  it.each(["850000", "850.000", "850 000", "850,000", "850.000đ", " 850.000 ₫ "])(
    "given %j, when read, then it is 850000",
    (text) => {
      expect(parseMoneyInput(text)).toBe(850_000);
    },
  );

  it.each(["", "abc", "1.5tr", "-5000", "12a"])(
    "given %j, when read, then it is nothing",
    (text) => {
      expect(parseMoneyInput(text)).toBeUndefined();
    },
  );

  it("given more than money can hold, when read, then it is nothing", () => {
    expect(parseMoneyInput(String(moneyMax + 1))).toBeUndefined();
    expect(parseMoneyInput(String(moneyMax))).toBe(moneyMax);
  });
});

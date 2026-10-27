import { describe, expect, it } from "vitest";

import { moneySchema } from "@/shared/domain/money-schema";

import { nameWords } from "./customer-words";
import { unitPriceOf } from "./line-price";
import { moneyWords } from "./money-words";

const money = (amount: number) => moneySchema.parse(amount);

describe("moneyWords", () => {
  it.each([
    ["500k", 500_000],
    ["95k/hộp", 95_000],
    ["85 nghìn", 85_000],
    ["1tr2", 1_200_000],
    ["2tr5", 2_500_000],
    ["6 triệu", 6_000_000],
    ["2 củ", 2_000_000],
    ["1,5tr", 1_500_000],
    ["1.200.000đ", 1_200_000],
    ["350000", 350_000],
  ])("given %j, when read, then it is %d", (written, amount) => {
    expect(moneyWords(written)).toBe(amount);
  });

  it("given words with no amount, or more than money holds, when read, then there is none", () => {
    expect(moneyWords("giá tốt")).toBeUndefined();
    expect(moneyWords("9999999tr")).toBeUndefined();
  });
});

describe("nameWords", () => {
  it.each([
    ["chị Lan", ["lan"]],
    ["nha khoa Minh Châu", ["minh", "chau"]],
    ["nk Ánh Dương", ["anh", "duong"]],
    ["Ánh Dương", ["anh", "duong"]],
    ["bv Quận 7", ["quan", "7"]],
    ["Hương Lan", ["huong", "lan"]],
    ["chi lan", ["lan"]],
    ["chị", []],
  ])("given %j, when its name is taken, then it is %j", (written, words) => {
    expect(nameWords(written)).toEqual(words);
  });
});

describe("unitPriceOf", () => {
  it("given a price said to be for one unit, or a single unit, when priced, then the amount is the unit price", () => {
    expect(unitPriceOf(money(95_000), 5, true, undefined)).toBe(95_000);
    expect(unitPriceOf(money(1_200_000), 1, false, undefined)).toBe(1_200_000);
  });

  it("given a bare amount and no history, when priced, then it is the line's total", () => {
    expect(unitPriceOf(money(500_000), 2, false, undefined)).toBe(250_000);
  });

  it("given a bare amount and a last price, when priced, then the reading nearer the last price wins", () => {
    expect(unitPriceOf(money(30_000), 50, false, money(32_000))).toBe(30_000);
    expect(unitPriceOf(money(500_000), 2, false, money(240_000))).toBe(250_000);
  });
});

import { describe, expect, it } from "vitest";

import { customerIdSchema } from "@/features/customers/domain/customer";
import type { OrderSnapshot } from "@/features/orders/domain/order-change";
import { productIdSchema } from "@/features/products/domain/product";
import { moneySchema } from "@/shared/domain/money-schema";

import { changeText, type Names } from "./history-text";

const lan = customerIdSchema.parse("019a0000-0000-7000-8000-0000000000c1");
const lanAnh = customerIdSchema.parse("019a0000-0000-7000-8000-0000000000c2");
const gel = productIdSchema.parse("019a0000-0000-7000-8000-0000000000d1");
const anaesthetic = productIdSchema.parse("019a0000-0000-7000-8000-0000000000d2");

const names: Names = {
  customer: (id) => (id === lan ? "chị Lan" : "Nha khoa Lan Anh"),
  product: (id) => (id === gel ? "gel tê" : "Thuốc tê"),
};

function snapshot(
  customerId: OrderSnapshot["customerId"],
  products: ReadonlyArray<OrderSnapshot["lines"][number]["productId"]>,
): OrderSnapshot {
  return {
    customerId,
    orderedOn: "2026-10-23",
    deliveredOn: null,
    note: null,
    lines: products.map((productId) => ({
      productId,
      quantity: 1,
      unitPrice: moneySchema.parse(10_000),
    })),
    payments: [],
    deleted: false,
  };
}

describe("changeText for merges", () => {
  it("given a customer merge, when told, then it names the customer before and after", () => {
    expect(
      changeText("customer_merged", snapshot(lan, [gel]), snapshot(lanAnh, [gel]), names),
    ).toEqual({ headline: "Gộp khách", details: ["Khách: chị Lan → Nha khoa Lan Anh"] });
  });

  it.each([
    ["the kept product was not on the order", [gel], [anaesthetic]],
    ["the kept product was on it already", [gel, anaesthetic], [anaesthetic, anaesthetic]],
  ])(
    "given a product merge where %s, when told, then it names the product before and after",
    (_, before, after) => {
      expect(
        changeText("product_merged", snapshot(lan, before), snapshot(lan, after), names),
      ).toEqual({
        headline: "Gộp sản phẩm",
        details: ["Sản phẩm: gel tê → Thuốc tê"],
      });
    },
  );
});

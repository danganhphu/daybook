import type { OrderChangeKind, OrderSnapshot } from "@/features/orders/domain/order-change";
import { moneyText } from "@/shared/web/money-text";

import { shortDay } from "./day-text";

// One change from the log in the user's words: "Thu 300.000đ", "Thuốc tê: 2 → 3". Pure, so every kind of change is
// tested without a database.

export type Names = {
  readonly product: (id: string) => string;
  readonly customer: (id: string) => string;
};

type Line = OrderSnapshot["lines"][number];

const headlines: Record<OrderChangeKind, string> = {
  placed: "Tạo đơn",
  revised: "Sửa đơn",
  delivered: "Đã giao",
  undelivered: "Bỏ đánh dấu đã giao",
  payment_added: "Thu tiền",
  payment_removed: "Bỏ một lần thu",
  deleted: "Xoá đơn",
  restored: "Khôi phục đơn",
  customer_merged: "Gộp khách",
  product_merged: "Gộp sản phẩm",
};

export type ChangeText = {
  readonly headline: string;
  // What exactly, a line each; empty when the headline says it all
  readonly details: ReadonlyArray<string>;
};

// Lines grouped by product, in the order they first appear: a revision compares products, not positions
function byProduct(
  lines: ReadonlyArray<Line>,
): Map<string, { quantity: number; unitPrice: number }> {
  const grouped = new Map<string, { quantity: number; unitPrice: number }>();
  for (const line of lines) {
    const seen = grouped.get(line.productId);
    grouped.set(line.productId, {
      quantity: (seen?.quantity ?? 0) + line.quantity,
      unitPrice: line.unitPrice,
    });
  }

  return grouped;
}

function revisionDetails(before: OrderSnapshot, after: OrderSnapshot, names: Names): string[] {
  const details: string[] = [];
  if (before.customerId !== after.customerId) {
    details.push(
      `Khách: ${names.customer(before.customerId)} → ${names.customer(after.customerId)}`,
    );
  }
  if (before.orderedOn !== after.orderedOn) {
    details.push(`Ngày đặt: ${shortDay(before.orderedOn)} → ${shortDay(after.orderedOn)}`);
  }

  const was = byProduct(before.lines);
  const now = byProduct(after.lines);
  for (const [id, line] of now) {
    const old = was.get(id);
    const name = names.product(id);
    if (old === undefined) {
      details.push(`Thêm ${name}: ${line.quantity} × ${moneyText(line.unitPrice)}`);
      continue;
    }
    if (old.quantity !== line.quantity) {
      details.push(`${name}: ${old.quantity} → ${line.quantity}`);
    }
    if (old.unitPrice !== line.unitPrice) {
      details.push(`Giá ${name}: ${moneyText(old.unitPrice)} → ${moneyText(line.unitPrice)}`);
    }
  }
  for (const id of was.keys()) {
    if (!now.has(id)) {
      details.push(`Bỏ ${names.product(id)}`);
    }
  }

  if (before.note !== after.note) {
    details.push(after.note === null ? "Xoá ghi chú" : `Ghi chú: ${after.note}`);
  }

  return details;
}

function linesPerProduct(lines: ReadonlyArray<Line>): Map<string, number> {
  const counted = new Map<string, number>();
  for (const line of lines) {
    counted.set(line.productId, (counted.get(line.productId) ?? 0) + 1);
  }

  return counted;
}

// The product a merge took off the order, and the one its lines went to - which may have been on the order already,
// so it is found by its count of lines growing, not by being new
function productsMerged(before: OrderSnapshot, after: OrderSnapshot, names: Names): string[] {
  const was = linesPerProduct(before.lines);
  const now = linesPerProduct(after.lines);
  const gone = [...was.keys()].filter((id) => !now.has(id));
  const grew = [...now].filter(([id, lines]) => lines > (was.get(id) ?? 0)).map(([id]) => id);

  return gone.flatMap((from) =>
    grew.map((into) => `Sản phẩm: ${names.product(from)} → ${names.product(into)}`),
  );
}

function paymentAdded(before: OrderSnapshot | undefined, after: OrderSnapshot): string[] {
  const known = new Set(before?.payments.map((payment) => payment.id));

  return after.payments
    .filter((payment) => !known.has(payment.id))
    .map((payment) => `${moneyText(payment.amount)}, ngày ${shortDay(payment.paidOn)}`);
}

function paymentRemoved(before: OrderSnapshot | undefined, after: OrderSnapshot): string[] {
  const wasRemoved = new Set(
    before?.payments.filter((payment) => payment.removed).map((payment) => payment.id),
  );

  return after.payments
    .filter((payment) => payment.removed && !wasRemoved.has(payment.id))
    .map((payment) => `${moneyText(payment.amount)}, ngày ${shortDay(payment.paidOn)}`);
}

export function changeText(
  kind: OrderChangeKind,
  before: OrderSnapshot | undefined,
  after: OrderSnapshot,
  names: Names,
): ChangeText {
  const headline = headlines[kind];

  switch (kind) {
    case "revised":
      return {
        headline,
        details: before === undefined ? [] : revisionDetails(before, after, names),
      };
    case "delivered":
      return {
        headline,
        details: after.deliveredOn === null ? [] : [`Ngày ${shortDay(after.deliveredOn)}`],
      };
    case "payment_added":
      return { headline, details: paymentAdded(before, after) };
    case "payment_removed":
      return { headline, details: paymentRemoved(before, after) };
    case "customer_merged":
      return {
        headline,
        details:
          before === undefined
            ? []
            : [`Khách: ${names.customer(before.customerId)} → ${names.customer(after.customerId)}`],
      };
    case "product_merged":
      return {
        headline,
        details: before === undefined ? [] : productsMerged(before, after, names),
      };
    case "placed":
    case "undelivered":
    case "deleted":
    case "restored":
      return { headline, details: [] };
    default:
      return kind satisfies never;
  }
}

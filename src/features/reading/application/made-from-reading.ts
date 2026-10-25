import { Temporal } from "temporal-polyfill/implementation";

import type { CaptureId } from "@/features/capture/domain/capture";
import type { CustomerId } from "@/features/customers/domain/customer";
import type { LineInput } from "@/features/orders/application/order-input";
import {
  prepareOrder,
  type PlaceOrderError,
  type PreparedOrder,
} from "@/features/orders/application/place-order";
import { quantitySchema } from "@/features/orders/domain/order";
import { productNameSchema, type ProductName } from "@/features/products/domain/product";
import { unitPriceOf } from "@/features/reading/domain/line-price";
import { moneyWords } from "@/features/reading/domain/money-words";
import type { Reading, ReadLine } from "@/features/reading/domain/reading";
import * as Reminders from "@/features/reminders/domain/reminder";
import type { LiveReminder } from "@/features/reminders/domain/reminder";
import type { AccountId } from "@/shared/domain/account-id";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import type { Content } from "@/shared/domain/content";
import { zeroMoney } from "@/shared/domain/money";
import { err, type Result } from "@/shared/domain/result";
import { searchText } from "@/shared/domain/search-text";

import type { ReadingDeps } from "./reading-deps";

// What a message is about: who typed it, the day it was written, and its words
export type Message = {
  readonly captureId: CaptureId;
  readonly content: Content;
  readonly day: Temporal.PlainDate;
  readonly by: AccountId;
};

// The order a reading describes, checked like one from the form but not yet written. A line's amount becomes its
// unit price; a line with none is sold at its last price, or at nothing until someone fills it in.
export async function prepareOrderFrom(
  deps: Pick<ReadingDeps, "clock" | "customers" | "products" | "orderQueries">,
  message: Message,
  reading: Reading,
  customerId: CustomerId,
): Promise<Result<PreparedOrder, PlaceOrderError | "product_unnamed">> {
  const named: Array<{ readonly line: ReadLine; readonly name: ProductName }> = [];
  for (const line of reading.lines) {
    const name = productNameSchema.safeParse(line.product);
    if (!name.success) {
      return err("product_unnamed");
    }
    named.push({ line, name: name.data });
  }

  const known = new Map(
    (await deps.products.findActiveNamed(named.map(({ name }) => name))).map((product) => [
      searchText(product.name),
      product.id,
    ]),
  );
  const lastPrices = await deps.orderQueries.lastPrices([...new Set(known.values())], customerId);

  const lines = named.map(({ line, name }): LineInput => {
    const productId = known.get(searchText(name));
    const lastPrice = productId === undefined ? undefined : lastPrices.get(productId);
    const quantity = line.quantity ?? 1;
    const amount = line.price === null ? undefined : moneyWords(line.price);

    return {
      product: productId === undefined ? { name } : { id: productId },
      quantity: quantitySchema.parse(quantity),
      unitPrice:
        amount === undefined
          ? (lastPrice ?? zeroMoney)
          : unitPriceOf(amount, quantity, line.priceIsPerUnit, lastPrice),
    };
  });

  return prepareOrder(deps, {
    by: message.by,
    order: {
      customerId,
      orderedOn: message.day,
      lines,
      note: undefined,
      captureId: message.captureId,
    },
  });
}

// The reminder a reading describes: the message itself is the errand, due the day it names, or the day it was
// written when that is all it says - never a day before it
export function reminderFrom(
  message: Message,
  reading: Reading,
  customerId: CustomerId | undefined,
  at: Temporal.Instant,
): LiveReminder {
  const named = calendarDaySchema.safeParse(reading.dueOn);
  const dueOn =
    named.success && Temporal.PlainDate.compare(named.data, message.day) >= 0
      ? named.data
      : message.day;

  return Reminders.create(
    { text: message.content, dueOn, customerId },
    message.captureId,
    message.by,
    at,
  );
}

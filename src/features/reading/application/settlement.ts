import type { CaptureId } from "@/features/capture/domain/capture";
import type { ActiveCustomer, CustomerId } from "@/features/customers/domain/customer";
import { writeOrder, type PreparedOrder } from "@/features/orders/application/place-order";
import * as Interpretations from "@/features/reading/domain/interpretation";
import type { Interpretation, ReadingContext } from "@/features/reading/domain/interpretation";
import type { Reading } from "@/features/reading/domain/reading";
import type { LiveReminder } from "@/features/reminders/domain/reminder";
import { commitUnlessStale } from "@/shared/application/stale-write";

import { prepareOrderFrom, reminderFrom, type Message } from "./made-from-reading";
import { matchCustomer } from "./match-customer";
import type { ReadingDeps } from "./reading-deps";

// A reading and what it makes, written together or not at all
export type Settlement = {
  readonly interpretation: Interpretation;
  readonly order?: PreparedOrder;
  readonly reminder?: LiveReminder;
  // Added by a person answering, for the order made for them
  readonly customer?: ActiveCustomer;
};

// Whether a message has been settled: something was made from it, or a reading already said what it is. Only a
// failed reading may be read again, and only an unsure one answered.
export async function latestReading(
  deps: Pick<ReadingDeps, "interpretations" | "orderQueries" | "reminders">,
  captureId: CaptureId,
): Promise<{ readonly made: boolean; readonly latest: Interpretation | undefined }> {
  const [orders, reminders, latest] = await Promise.all([
    deps.orderQueries.madeFrom([captureId]),
    deps.reminders.madeFrom([captureId]),
    deps.interpretations.latestFor([captureId]),
  ]);

  return { made: orders.length + reminders.length > 0, latest: latest.get(captureId) };
}

export async function orderSettlement(
  deps: Pick<ReadingDeps, "clock" | "customers" | "products" | "orderQueries">,
  context: ReadingContext,
  message: Message,
  reading: Reading,
  customerId: CustomerId,
): Promise<Settlement> {
  const prepared = await prepareOrderFrom(deps, message, reading, customerId);

  return prepared.ok
    ? {
        interpretation: Interpretations.understood(context, "order", reading),
        order: prepared.value,
      }
    : { interpretation: Interpretations.failed(context, "refused") };
}

// What a model's reading makes. An order waits for a person when its customer is not one of the list's; a reminder
// does not, and keeps its customer only when the name is plainly one.
export async function settle(
  deps: Pick<ReadingDeps, "clock" | "customers" | "products" | "orderQueries">,
  context: ReadingContext,
  message: Message,
  reading: Reading,
): Promise<Settlement> {
  switch (reading.kind) {
    case "note":
      return { interpretation: Interpretations.understood(context, "note", reading) };

    case "reminder": {
      const match = await matchCustomer(deps.customers, reading.customer);
      return {
        interpretation: Interpretations.understood(context, "reminder", reading),
        reminder: reminderFrom(
          message,
          reading,
          match.found === "one" ? match.customerId : undefined,
          context.readAt,
        ),
      };
    }

    case "order": {
      if (reading.lines.length === 0) {
        return { interpretation: Interpretations.understood(context, "note", reading) };
      }
      const match = await matchCustomer(deps.customers, reading.customer);
      switch (match.found) {
        case "one":
          return orderSettlement(deps, context, message, reading, match.customerId);
        case "none":
          return { interpretation: Interpretations.unsure(context, reading, "unknown", []) };
        case "many":
          return {
            interpretation: Interpretations.unsure(context, reading, "ambiguous", match.candidates),
          };
        default:
          return match satisfies never;
      }
    }

    default:
      return reading.kind satisfies never;
  }
}

// Written as one batch. Stale when another reading or answer settled the message first: the database refuses a
// reading after a settled one, so two requests at once cannot make two orders. The reading goes first, so that
// refusal comes before anything it made could clash with what the other request made, such as the same new product.
export async function commitSettlement(
  deps: Pick<ReadingDeps, "startUnitOfWork">,
  settlement: Settlement,
): Promise<"committed" | "stale"> {
  const work = deps.startUnitOfWork();
  work.interpretations.add(settlement.interpretation);
  if (settlement.customer !== undefined) {
    work.customers.add(settlement.customer);
  }
  if (settlement.order !== undefined) {
    writeOrder(work, settlement.order);
  }
  if (settlement.reminder !== undefined) {
    work.reminders.add(settlement.reminder);
  }

  return commitUnlessStale(work);
}

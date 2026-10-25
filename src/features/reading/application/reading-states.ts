import type { CaptureId } from "@/features/capture/domain/capture";
import type { ActiveCustomer } from "@/features/customers/domain/customer";
import type { OrderMadeFrom } from "@/features/orders/application/order-queries";
import type { CustomerQuestion, ReadFailure } from "@/features/reading/domain/interpretation";
import type { LiveReminder } from "@/features/reminders/domain/reminder";

import type { ReadingDeps } from "./reading-deps";

// What a note shows about its message: what was made of it, the question it waits on, that reading failed, or that
// it was never read - a note from before reading began, or one whose reading never reached the server. Nothing for a
// message read as a note.
export type ReadingState =
  | { readonly kind: "unread" }
  | { readonly kind: "order"; readonly order: OrderMadeFrom }
  | { readonly kind: "reminder"; readonly reminder: LiveReminder }
  | {
      readonly kind: "unsure";
      readonly question: CustomerQuestion;
      // The customer as the message writes them
      readonly written: string | null;
      // Only those still in the list
      readonly candidates: ReadonlyArray<ActiveCustomer>;
    }
  | { readonly kind: "failed"; readonly failure: ReadFailure };

// Four queries for a whole day of notes, whatever its length
export async function readingStates(
  deps: Pick<ReadingDeps, "interpretations" | "orderQueries" | "reminders" | "customers">,
  captureIds: ReadonlyArray<CaptureId>,
): Promise<ReadonlyMap<CaptureId, ReadingState>> {
  const [orders, reminders, latest] = await Promise.all([
    deps.orderQueries.madeFrom(captureIds),
    deps.reminders.madeFrom(captureIds),
    deps.interpretations.latestFor(captureIds),
  ]);
  const asked = [...latest.values()].flatMap((reading) =>
    reading.outcome === "unsure" ? reading.candidates : [],
  );
  const candidates = new Map(
    (await deps.customers.getMany(asked)).flatMap((customer) =>
      customer.status === "active" ? [[customer.id, customer] as const] : [],
    ),
  );

  const states = new Map<CaptureId, ReadingState>();
  for (const captureId of captureIds) {
    const reading = latest.get(captureId);
    if (reading === undefined) {
      states.set(captureId, { kind: "unread" });
    } else if (reading.outcome === "unsure") {
      states.set(captureId, {
        kind: "unsure",
        question: reading.question,
        written: reading.reading.customer,
        candidates: reading.candidates.flatMap((id) => {
          const customer = candidates.get(id);
          return customer === undefined ? [] : [customer];
        }),
      });
    } else if (reading.outcome === "failed") {
      states.set(captureId, { kind: "failed", failure: reading.failure });
    }
  }
  // What was made outranks what a reading said, whoever made it
  for (const reminder of reminders) {
    if (reminder.captureId !== undefined) {
      states.set(reminder.captureId, { kind: "reminder", reminder });
    }
  }
  for (const order of orders) {
    states.set(order.captureId, { kind: "order", order });
  }

  return states;
}

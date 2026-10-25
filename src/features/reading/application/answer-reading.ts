import * as Customers from "@/features/customers/domain/customer";
import {
  customerDetailsSchema,
  type ActiveCustomer,
  type CustomerId,
} from "@/features/customers/domain/customer";
import type { CustomerRepository } from "@/features/customers/domain/customer-repository";
import type { NoteId } from "@/features/notes/domain/note";
import * as Interpretations from "@/features/reading/domain/interpretation";
import { personReader } from "@/features/reading/domain/interpretation";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";
import { vietnamDate } from "@/shared/domain/vietnam-day";

import type { Message } from "./made-from-reading";
import type { ReadingDeps } from "./reading-deps";
import type { ReadingError } from "./reading-errors";
import { commitSettlement, latestReading, orderSettlement, type Settlement } from "./settlement";

// What a person says to a reading that asked whose order it is
export type ReadingAnswer =
  | { readonly kind: "customer"; readonly customerId: CustomerId }
  // A new customer, named as the message writes them
  | { readonly kind: "new_customer" }
  // Not an order after all: the note stays a note
  | { readonly kind: "dismiss" };

export type AnswerReadingInput = {
  readonly by: AccountId;
  readonly noteId: NoteId;
  readonly answer: ReadingAnswer;
};

export type AnswerReadingError = Extract<
  ReadingError,
  "note_unavailable" | "not_asked" | "customer_unavailable" | "customer_unnamed"
>;

// The customer list as an order made in this same batch sees it: with the customer the answer adds
function including(customers: CustomerRepository, added: ActiveCustomer): CustomerRepository {
  return {
    get: async (id) => (id === added.id ? added : customers.get(id)),
    getMany: (ids) => customers.getMany(ids),
    list: (filter, limit) => customers.list(filter, limit),
  };
}

// Settles a reading that waited for a person, from the words it kept; the model is not asked again
export async function answerReading(
  deps: ReadingDeps,
  input: AnswerReadingInput,
): Promise<Result<Settlement, AnswerReadingError>> {
  const note = await deps.notes.get(input.noteId);
  const capture = note?.status === "live" ? await deps.captures.get(note.captureId) : undefined;
  if (capture === undefined) {
    return err("note_unavailable");
  }

  const { made, latest } = await latestReading(deps, capture.id);
  if (made || latest?.outcome !== "unsure") {
    return err("not_asked");
  }

  const at = deps.clock();
  const context = {
    captureId: capture.id,
    reader: personReader,
    readAt: at,
    readBy: input.by,
    neurons: undefined,
  };
  const message: Message = {
    captureId: capture.id,
    content: capture.content,
    day: vietnamDate(capture.receivedAt),
    by: input.by,
  };
  const { reading } = latest;

  let settlement: Settlement;
  switch (input.answer.kind) {
    case "dismiss":
      settlement = { interpretation: Interpretations.understood(context, "note", reading) };
      break;

    case "customer": {
      const customer = await deps.customers.get(input.answer.customerId);
      if (customer?.status !== "active") {
        return err("customer_unavailable");
      }
      settlement = await orderSettlement(deps, context, message, reading, customer.id);
      break;
    }

    case "new_customer": {
      const details = customerDetailsSchema.safeParse({ name: reading.customer ?? "" });
      if (!details.success) {
        return err("customer_unnamed");
      }
      const customer = Customers.create(details.data, input.by, at);
      const order = await orderSettlement(
        { ...deps, customers: including(deps.customers, customer) },
        context,
        message,
        reading,
        customer.id,
      );
      // Added only with the order it is for
      settlement = order.order === undefined ? order : { ...order, customer };
      break;
    }

    default:
      return input.answer satisfies never;
  }

  return (await commitSettlement(deps, settlement)) === "committed"
    ? ok(settlement)
    : err("not_asked");
}

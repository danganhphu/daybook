import { z } from "zod";

import { noteIdSchema, type NoteId } from "@/features/notes/domain/note";
import { orderIdSchema, type OrderId } from "@/features/orders/domain/order";
import { reminderIdSchema, type ReminderId } from "@/features/reminders/domain/reminder";
import { versionSchema, type Version } from "@/shared/domain/audit";

// What a button asks for. Each carries the version the card showed, so a tap on an old card changes nothing newer
// (ADR 0013, decision 5); an answer names the reading's candidate by its place, never a customer id the chat sends.
export type CallbackAction =
  | { readonly kind: "undo_order"; readonly id: OrderId; readonly version: Version }
  | { readonly kind: "restore_order"; readonly id: OrderId; readonly version: Version }
  | { readonly kind: "undo_reminder"; readonly id: ReminderId; readonly version: Version }
  | { readonly kind: "restore_reminder"; readonly id: ReminderId; readonly version: Version }
  | { readonly kind: "complete_reminder"; readonly id: ReminderId; readonly version: Version }
  // Xoá on a note asks first; only the question's own Xoá deletes
  | { readonly kind: "ask_delete_note"; readonly id: NoteId; readonly version: Version }
  | { readonly kind: "delete_note"; readonly id: NoteId; readonly version: Version }
  | { readonly kind: "restore_note"; readonly id: NoteId; readonly version: Version }
  // Back to the note's card: Huỷ on the question
  | { readonly kind: "show_note"; readonly id: NoteId }
  | {
      readonly kind: "answer_customer";
      readonly id: NoteId;
      readonly candidate: number;
      // The end of the candidate's id, so a list that changed since the card cannot pick someone else
      readonly customerTail: string;
    }
  | { readonly kind: "answer_new_customer"; readonly id: NoteId }
  | { readonly kind: "answer_not_order"; readonly id: NoteId }
  | { readonly kind: "read_again"; readonly id: NoteId };

// Bot API, InlineKeyboardButton: callback_data is 1-64 bytes
export const callbackDataMaxBytes = 64;

// From a UUID v7's end, which is random (RFC 9562, 5.7, rand_b; the uuid package fills its last five bytes afresh for
// each id): its start is the time it was made, which customers added together share
export const customerTailLength = 8;

export function customerTail(customerId: string): string {
  return customerId.slice(-customerTailLength);
}

const codes = {
  undo_order: "uo",
  restore_order: "ko",
  undo_reminder: "ur",
  restore_reminder: "kr",
  complete_reminder: "cr",
  ask_delete_note: "dn",
  delete_note: "xn",
  restore_note: "kn",
  show_note: "vn",
  answer_customer: "ac",
  answer_new_customer: "an",
  answer_not_order: "ad",
  read_again: "rn",
} as const satisfies Record<CallbackAction["kind"], string>;

function fields(action: CallbackAction): ReadonlyArray<string | number> {
  switch (action.kind) {
    case "undo_order":
    case "restore_order":
    case "undo_reminder":
    case "restore_reminder":
    case "complete_reminder":
    case "ask_delete_note":
    case "delete_note":
    case "restore_note":
      return [action.id, action.version];
    case "answer_customer":
      return [action.id, action.candidate, action.customerTail];
    case "show_note":
    case "answer_new_customer":
    case "answer_not_order":
    case "read_again":
      return [action.id];
    default:
      return action satisfies never;
  }
}

export function callbackData(action: CallbackAction): string {
  const data = [codes[action.kind], ...fields(action)].join(":");
  if (new TextEncoder().encode(data).length > callbackDataMaxBytes) {
    throw new Error(`Callback data over ${callbackDataMaxBytes} bytes: ${action.kind}`);
  }

  return data;
}

const candidateSchema = z.coerce.number().pipe(z.int().min(0));

const tailSchema = z.string().regex(new RegExp(`^[0-9a-f]{${customerTailLength}}$`));

const versionField = z.coerce.number().pipe(versionSchema);

function versioned<S extends z.ZodType>(idSchema: S, rest: ReadonlyArray<string>) {
  const [id, version, extra] = rest;
  const parsedId = idSchema.safeParse(id);
  const parsedVersion = versionField.safeParse(version);

  return parsedId.success && parsedVersion.success && extra === undefined
    ? { id: parsedId.data, version: parsedVersion.data }
    : undefined;
}

function noteOnly(rest: ReadonlyArray<string>) {
  const [id, extra] = rest;
  const parsed = noteIdSchema.safeParse(id);

  return parsed.success && extra === undefined ? { id: parsed.data } : undefined;
}

function answer(rest: ReadonlyArray<string>) {
  const [id, candidate, tail, extra] = rest;
  const parsedId = noteIdSchema.safeParse(id);
  const parsedCandidate = candidateSchema.safeParse(candidate);
  const parsedTail = tailSchema.safeParse(tail);

  return parsedId.success && parsedCandidate.success && parsedTail.success && extra === undefined
    ? { id: parsedId.data, candidate: parsedCandidate.data, customerTail: parsedTail.data }
    : undefined;
}

function withKind<K extends CallbackAction["kind"], T>(kind: K, parsed: T | undefined) {
  return parsed === undefined ? undefined : { kind, ...parsed };
}

// What a tap asks for, or undefined for data this bot never wrote: as untrusted as any message
export function parseCallbackData(data: string): CallbackAction | undefined {
  const [code, ...rest] = data.split(":");
  switch (code) {
    case codes.undo_order:
      return withKind("undo_order", versioned(orderIdSchema, rest));
    case codes.restore_order:
      return withKind("restore_order", versioned(orderIdSchema, rest));
    case codes.undo_reminder:
      return withKind("undo_reminder", versioned(reminderIdSchema, rest));
    case codes.restore_reminder:
      return withKind("restore_reminder", versioned(reminderIdSchema, rest));
    case codes.complete_reminder:
      return withKind("complete_reminder", versioned(reminderIdSchema, rest));
    case codes.ask_delete_note:
      return withKind("ask_delete_note", versioned(noteIdSchema, rest));
    case codes.delete_note:
      return withKind("delete_note", versioned(noteIdSchema, rest));
    case codes.restore_note:
      return withKind("restore_note", versioned(noteIdSchema, rest));
    case codes.show_note:
      return withKind("show_note", noteOnly(rest));
    case codes.answer_customer:
      return withKind("answer_customer", answer(rest));
    case codes.answer_new_customer:
      return withKind("answer_new_customer", noteOnly(rest));
    case codes.answer_not_order:
      return withKind("answer_not_order", noteOnly(rest));
    case codes.read_again:
      return withKind("read_again", noteOnly(rest));
    default:
      return undefined;
  }
}

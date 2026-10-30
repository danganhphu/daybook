import type { CustomerId } from "@/features/customers/domain/customer";
import type { CustomerKindId } from "@/features/customers/domain/customer-kind";
import type { NoteId } from "@/features/notes/domain/note";
import type { OrderId } from "@/features/orders/domain/order";
import type { ProductId } from "@/features/products/domain/product";
import type { ReminderId } from "@/features/reminders/domain/reminder";
import type { Version } from "@/shared/domain/audit";

// "Đã xoá gần đây": anything deleted, restorable for thirty days, then gone from the database for good, as it is sooner
// when deleted for good by hand (ADR 0017). A customer goes in with their orders and reminders, and they come back or
// go for good together.

export const trashKinds = ["order", "note", "reminder", "customer", "product", "kind"] as const;

export type TrashKind = (typeof trashKinds)[number];

// One thing in the trash, as the screen showed it
export type TrashItem =
  | { readonly kind: "order"; readonly id: OrderId; readonly shown: Version }
  | { readonly kind: "note"; readonly id: NoteId; readonly shown: Version }
  | { readonly kind: "reminder"; readonly id: ReminderId; readonly shown: Version }
  | { readonly kind: "customer"; readonly id: CustomerId; readonly shown: Version }
  | { readonly kind: "product"; readonly id: ProductId; readonly shown: Version }
  | { readonly kind: "kind"; readonly id: CustomerKindId; readonly shown: Version };

export function itemsOf<K extends TrashKind>(
  items: ReadonlyArray<TrashItem>,
  kind: K,
): ReadonlyArray<Extract<TrashItem, { readonly kind: K }>> {
  return items.filter(
    (item): item is Extract<TrashItem, { readonly kind: K }> => item.kind === kind,
  );
}

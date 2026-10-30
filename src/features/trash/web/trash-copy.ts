import type { TrashKind } from "@/features/trash/domain/trash";

// What "Đã xoá gần đây" says beyond its title, in one place
export const trashCopy = {
  restoreAll: "Khôi phục tất cả",
  purge: "Xoá vĩnh viễn",
  purgeAll: "Xoá tất cả",
  // Under the question before deleting for good, when a customer is among what goes
  purgeTakesOrders: "Đơn và việc cần nhắc xoá cùng khách cũng mất theo.",
  kinds: {
    order: "Đơn hàng",
    note: "Ghi chú",
    reminder: "Việc cần nhắc",
    customer: "Khách",
    product: "Sản phẩm",
    kind: "Loại khách",
  } satisfies Record<TrashKind, string>,
} as const;

// "Xoá vĩnh viễn 3 mục?"
export function purgeQuestion(count: number): string {
  return count === 1 ? "Xoá vĩnh viễn mục này?" : `Xoá vĩnh viễn ${count} mục?`;
}

export function restoredText(count: number): string {
  return count === 1 ? "Đã khôi phục" : `Đã khôi phục ${count} mục`;
}

export function purgedText(count: number): string {
  return count === 1 ? "Đã xoá vĩnh viễn" : `Đã xoá vĩnh viễn ${count} mục`;
}

// The toast when some could not: "2 mục chưa khôi phục được"
export function notRestoredText(count: number): string {
  return `${count} mục chưa khôi phục được`;
}

export function notPurgedText(count: number): string {
  return `${count} mục chưa xoá được`;
}

// What a customer takes into the trash: "5 đơn và 2 việc cần nhắc", or nothing
export function takenText(orders: number, reminders: number): string | undefined {
  const parts = [
    orders > 0 ? `${orders} đơn` : undefined,
    reminders > 0 ? `${reminders} việc cần nhắc` : undefined,
  ].filter((part) => part !== undefined);

  return parts.length === 0 ? undefined : parts.join(" và ");
}

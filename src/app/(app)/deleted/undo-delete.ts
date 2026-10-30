import type { TrashKind } from "@/features/trash/domain/trash";
import type { ToastOptions } from "@/shared/ui/toast/use-toast";
import { attempt } from "@/shared/web/attempt";
import { recentlyDeletedCopy } from "@/shared/web/recently-deleted";

import { restoreFromTrash } from "./actions";

// The toast's Undo after a customer, product or kind went to the trash: back from there, with what went with it.
// Answers what the next toast says.
export async function undoDelete(item: {
  readonly kind: TrashKind;
  readonly id: string;
  readonly version: number;
}): Promise<ToastOptions> {
  const result = await attempt(() =>
    restoreFromTrash([{ kind: item.kind, id: item.id, shown: item.version }]),
  );
  if (!result.ok) {
    return { title: result.error };
  }
  const [refused] = result.value.refused;

  return { title: refused === undefined ? recentlyDeletedCopy.restored : refused.message };
}

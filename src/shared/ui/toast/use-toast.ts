import { Toast } from "@base-ui/react/toast";
import { useMemo } from "react";

import { actionToastTimeout } from "./toast-timing";

export type ToastOptions = {
  // What happened, in a few words: "Đã xoá ghi chú"
  readonly title: string;
  // Which thing it happened to, when the title alone is ambiguous
  readonly description?: string;
  // One or two words; the toast closes when it is used
  readonly action?: { readonly label: string; readonly onAction: () => void };
};

// Raises toasts in the Toaster mounted above. Only from client components.
export function useToast() {
  const { add, close } = Toast.useToastManager();

  return useMemo(
    () => ({
      show({ title, description, action }: ToastOptions): string {
        const id = add({
          title,
          ...(description === undefined ? {} : { description }),
          ...(action === undefined
            ? {}
            : {
                timeout: actionToastTimeout,
                actionProps: {
                  children: action.label,
                  onClick() {
                    close(id);
                    action.onAction();
                  },
                },
              }),
        });

        return id;
      },
      close,
    }),
    [add, close],
  );
}

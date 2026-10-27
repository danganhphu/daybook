import { Toast } from "@base-ui/react/toast";

import { actionToastTimeout } from "./toast-timing";

export type ToastOptions = {
  // What happened, in a few words: "Đã xoá ghi chú"
  readonly title: string;
  // Which thing it happened to, when the title alone is ambiguous
  readonly description?: string;
  // One or two words; the toast closes when it is used
  readonly action?: { readonly label: string; readonly onAction: () => void };
};

// One manager for the app, held outside React: Base UI's useToastManager subscribes to the list, so every screen that
// raised toasts re-rendered whenever one came or went
export const toastManager = Toast.createToastManager();

const toast = {
  show({ title, description, action }: ToastOptions): string {
    const id = toastManager.add({
      title,
      ...(description === undefined ? {} : { description }),
      ...(action === undefined
        ? {}
        : {
            timeout: actionToastTimeout,
            actionProps: {
              children: action.label,
              onClick() {
                toastManager.close(id);
                action.onAction();
              },
            },
          }),
    });

    return id;
  },
  close: (id?: string) => toastManager.close(id),
};

// Raises toasts in the Toaster mounted above. Only from client components.
export function useToast() {
  return toast;
}

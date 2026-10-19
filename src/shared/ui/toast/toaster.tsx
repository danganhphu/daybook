"use client";

import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "@/shared/ui/button/icon-button";

import { plainToastTimeout } from "./toast-timing";

import styles from "./toast.module.scss";

const closeButton = <IconButton icon={X} label="Đóng thông báo" />;

// One viewport for the whole app: mount once, near the root, and raise toasts with useToast()
export function Toaster({ children }: { readonly children: ReactNode }) {
  return (
    <Toast.Provider timeout={plainToastTimeout}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className={styles.viewport} aria-label="Thông báo">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className={styles.toast}>
      <Toast.Content className={styles.content}>
        <div className={styles.text}>
          <Toast.Title className={styles.title} />
          <Toast.Description className={styles.description} />
        </div>
        <Toast.Action className={styles.action} />
        <Toast.Close render={closeButton} />
      </Toast.Content>
    </Toast.Root>
  ));
}

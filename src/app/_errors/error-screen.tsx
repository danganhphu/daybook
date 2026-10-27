"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useMemo } from "react";

import { actionLabels } from "@/shared/ui/action-labels";
import { Button } from "@/shared/ui/button/button";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { Screen } from "@/shared/ui/screen/screen";

const copy = {
  title: "Chưa mở được trang này",
  hint: "Kiểm tra mạng rồi thử lại.",
} as const;

// A screen that could not be made. vinext 1.2 gives an error file only `reset`, which redraws without asking the
// server again, so trying again refreshes first, as Next.js 16.3's `retry` does.
export function ErrorScreen({ reset }: { readonly reset: () => void }) {
  const router = useRouter();
  const retry = useCallback(() => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }, [router, reset]);
  const action = useMemo(
    () => (
      <Button variant="primary" onClick={retry}>
        {actionLabels.retry}
      </Button>
    ),
    [retry],
  );

  return (
    <Screen>
      <EmptyState title={copy.title} description={copy.hint} action={action} />
    </Screen>
  );
}

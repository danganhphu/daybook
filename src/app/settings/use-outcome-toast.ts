"use client";

import { useCallback } from "react";

import { useToast } from "@/shared/ui/toast/use-toast";

// A toast for how an action ended; none when there is nothing to say, as after a cancelled step-up
export function useOutcomeToast(): (message: string | undefined) => void {
  const toast = useToast();

  return useCallback(
    (message: string | undefined) => {
      if (message !== undefined) {
        toast.show({ title: message });
      }
    },
    [toast],
  );
}

"use client";

import { useCallback } from "react";

import { accessCopy } from "@/features/access/web/access-copy";
import { problemMessage } from "@/features/access/web/attempt-setting";
import { useToast } from "@/shared/ui/toast/use-toast";

import { endOtherDevices } from "./actions";
import type { StepUp } from "./use-step-up";

// After a way in changes, devices signed in the old way are still signed in: the toast offers to sign them out
// (ASVS 7.4.3). With no other device there is nothing to offer.
export function useWayInChanged(
  hasOtherDevices: boolean,
  run: StepUp["run"],
): (title: string) => void {
  const toast = useToast();

  const signOutOthers = useCallback(async () => {
    const ended = await run(() => endOtherDevices());
    const message = ended.ok
      ? `Đã ${accessCopy.signOutOthers.toLocaleLowerCase("vi")}`
      : problemMessage(ended.error);
    if (message !== undefined) {
      toast.show({ title: message });
    }
  }, [run, toast]);

  return useCallback(
    (title: string) => {
      if (!hasOtherDevices) {
        toast.show({ title });
        return;
      }
      // The list's own words, never a bare "Đăng xuất", which would read as signing out here
      toast.show({
        title,
        action: { label: accessCopy.signOutOthers, onAction: () => void signOutOthers() },
      });
    },
    [hasOtherDevices, signOutOthers, toast],
  );
}

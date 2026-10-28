"use client";

import { useCallback, useState, useTransition } from "react";

import { turnOnHere } from "@/app/settings/turn-on-push";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import { usePushDevice } from "@/features/notifications/web/use-push-device";
import { Button } from "@/shared/ui/button/button";
import { Notice } from "@/shared/ui/notice/notice";
import { useToast } from "@/shared/ui/toast/use-toast";
import { useBrowserCapability } from "@/shared/web/use-browser-capability";

// Per browser: once put off, the offer stays away; Settings still has the switch
const dismissedKey = "daybook.pushOfferDismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(dismissedKey) !== null;
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(dismissedKey, "1");
  } catch {
    // Storage refused: it is put off for this visit only
  }
}

// Shown on Hôm nay when something is due and this browser has never been asked: the moment the value is plain, as
// Chrome advises, rather than on the first visit
export function PushOffer({ publicKey }: { readonly publicKey: string }) {
  const device = usePushDevice();
  const dismissedBefore = useBrowserCapability(wasDismissed, true);
  const [hidden, setHidden] = useState(false);
  const [working, startWorking] = useTransition();
  const toast = useToast();

  const turnOn = useCallback(() => {
    startWorking(async () => {
      const said = await turnOnHere(publicKey);
      setHidden(true);
      dismiss();
      if (said !== undefined) {
        toast.show({ title: said });
      }
    });
  }, [publicKey, toast]);

  const later = useCallback(() => {
    dismiss();
    setHidden(true);
  }, []);

  if (hidden || dismissedBefore || device !== "undecided") {
    return null;
  }

  return (
    <Notice message={notificationsCopy.offer}>
      <Button variant="quiet" disabled={working} onClick={later}>
        {notificationsCopy.later}
      </Button>
      <Button variant="secondary" disabled={working} onClick={turnOn}>
        {notificationsCopy.turnOn}
      </Button>
    </Notice>
  );
}

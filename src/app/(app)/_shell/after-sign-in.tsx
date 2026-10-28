"use client";

import { useEffect } from "react";

import { tookNewSession } from "@/features/access/web/enter-app";

// Once, on the first page after a sign-in in this tab: this browser's notifications move onto the new session. The
// code for it loads only then.
export function AfterSignIn() {
  useEffect(() => {
    if (!tookNewSession()) {
      return;
    }
    void (async () => {
      const { keepPushOn } = await import("@/app/settings/turn-on-push");
      await keepPushOn();
    })();
  }, []);

  return null;
}

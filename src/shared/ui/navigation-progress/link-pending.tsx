"use client";

import { useLinkStatus } from "next/link";
import { useEffect } from "react";

import { beginNavigation } from "@/shared/web/navigation-pending";

// Inside a link: tells the bar along the top while the navigation it started is under way
export function LinkPending() {
  const { pending } = useLinkStatus();
  useEffect(() => (pending ? beginNavigation() : undefined), [pending]);

  return null;
}

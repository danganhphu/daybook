"use client";

import { ErrorScreen } from "@/app/_errors/error-screen";

// Settings, sign-in and setup, which sit outside the tab layout
export default function PageError({
  reset,
}: {
  readonly error: unknown;
  readonly reset: () => void;
}) {
  return <ErrorScreen reset={reset} />;
}

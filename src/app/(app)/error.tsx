"use client";

import { ErrorScreen } from "@/app/_errors/error-screen";

// Inside the tab layout, so the tab bar stays and she can go elsewhere
export default function PageError({
  reset,
}: {
  readonly error: unknown;
  readonly reset: () => void;
}) {
  return <ErrorScreen reset={reset} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Gallery } from "./gallery";

export const metadata: Metadata = {
  title: "UI - daybook",
  robots: { index: false },
};

// Every component in every state, so the look can be reviewed without a feature. Never served in production.
export default function UiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <Gallery />;
}

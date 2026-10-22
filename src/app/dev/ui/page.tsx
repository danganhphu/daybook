import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { appName } from "@/app/identity";

import { Gallery } from "./gallery";

export const metadata: Metadata = { title: `UI - ${appName}` };

// Every component in every state, so the look can be reviewed without a feature. Never served in production.
export default function UiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <Gallery />;
}

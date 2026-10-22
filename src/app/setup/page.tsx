import type { Metadata } from "next";

import { accessCopy } from "@/features/access/web/access-copy";

import { SetupScreen } from "./setup-screen";

export const metadata: Metadata = { title: accessCopy.setUpPasskey };

// Rendered per request: the page's scripts carry that response's CSP nonce, which a prerendered page cannot
export const dynamic = "force-dynamic";

export default function SetupPage() {
  return <SetupScreen />;
}

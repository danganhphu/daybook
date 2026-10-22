import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { daybook } from "@/composition/daybook";
import { accessCopy } from "@/features/access/web/access-copy";
import { currentSession } from "@/features/access/web/session-gate";
import { routes } from "@/shared/web/routes";

import { SignInScreen } from "./sign-in-screen";

export const metadata: Metadata = { title: accessCopy.signIn };

// Whether this browser is signed in changes with every visit
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if ((await currentSession(daybook())) !== undefined) {
    redirect(routes.today);
  }

  return <SignInScreen />;
}

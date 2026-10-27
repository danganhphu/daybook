import Link from "next/link";
import type { ComponentProps } from "react";

import { LinkPending } from "@/shared/ui/navigation-progress/link-pending";

export type AppLinkProps = ComponentProps<typeof Link>;

// Every link inside the app, so each navigation it starts shows on the bar along the top when it is slow
export function AppLink({ children, ...props }: AppLinkProps) {
  return (
    <Link {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}

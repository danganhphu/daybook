import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { customersScreen } from "@/features/customers/web/commands";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { unreadNotifications } from "@/features/notifications/web/inbox-commands";

import { CustomersScreen } from "./customers-screen";

export const metadata: Metadata = { title: customersCopy.title };

// Customers and their debts change with every visit
export const dynamic = "force-dynamic";

type CustomersPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const { q, kind, hidden } = await searchParams;
  const [view, unread] = await Promise.all([
    customersScreen(app, { q, kind, hidden }),
    unreadNotifications(app, session),
  ]);

  return <CustomersScreen view={view} unread={unread} />;
}

import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { ordersScreen } from "@/features/orders/web/commands";
import { ordersCopy } from "@/features/orders/web/orders-copy";

import { OrdersScreen } from "./orders-screen";

export const metadata: Metadata = { title: ordersCopy.title };

// Orders change with every visit
export const dynamic = "force-dynamic";

type OrdersPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const app = daybook();
  await requireSession(app);
  const { month, status, kind } = await searchParams;

  return <OrdersScreen view={await ordersScreen(app, { month, status, kind })} />;
}

import { notFound } from "next/navigation";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { orderScreen } from "@/features/orders/web/commands";

import { OrderScreen } from "./order-screen";

// An order changes with every payment and delivery
export const dynamic = "force-dynamic";

type OrderPageProps = { readonly params: Promise<{ readonly id: string }> };

export default async function OrderPage({ params }: OrderPageProps) {
  const app = daybook();
  await requireSession(app);
  const { id } = await params;
  const view = await orderScreen(app, id);
  if (view === undefined) {
    notFound();
  }

  return <OrderScreen view={view} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderForm } from "@/app/(app)/orders/order-form";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { orderForm } from "@/features/orders/web/commands";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { Screen } from "@/shared/ui/screen/screen";
import { orderPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: ordersCopy.edit };

// The form shows the order as stored now, with the version a save sends back
export const dynamic = "force-dynamic";

type EditOrderPageProps = { readonly params: Promise<{ readonly id: string }> };

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const app = daybook();
  await requireSession(app);
  const { id } = await params;
  const view = await orderForm(app, { id });
  if (view?.order === undefined) {
    notFound();
  }

  return (
    <Screen title={ordersCopy.edit} back={orderPath(view.order.id)}>
      <OrderForm view={view} />
    </Screen>
  );
}

import type { Metadata } from "next";

import { OrderForm } from "@/app/(app)/orders/order-form";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { orderForm } from "@/features/orders/web/commands";
import { ordersCopy } from "@/features/orders/web/orders-copy";
import { PageHeader } from "@/shared/ui/page-header/page-header";
import { Screen } from "@/shared/ui/screen/screen";
import { customerPath, routes } from "@/shared/web/routes";

export const metadata: Metadata = { title: ordersCopy.add };

// Today's date and the customer picked on their page change with every visit
export const dynamic = "force-dynamic";

type NewOrderPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const app = daybook();
  await requireSession(app);
  const { customer } = await searchParams;
  const view = await orderForm(app, { customer });

  return (
    <Screen>
      <PageHeader
        title={ordersCopy.add}
        back={view?.customer === undefined ? routes.orders : customerPath(view.customer.id)}
      />
      {view === undefined ? null : <OrderForm view={view} />}
    </Screen>
  );
}

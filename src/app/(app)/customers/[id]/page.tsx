import { notFound } from "next/navigation";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { customerScreen } from "@/features/customers/web/commands";
import { customerOrders } from "@/features/orders/web/commands";
import { customerReminders } from "@/features/reminders/web/commands";

import { CustomerScreen } from "./customer-screen";

// What they owe changes with every order and payment
export const dynamic = "force-dynamic";

type CustomerPageProps = { readonly params: Promise<{ readonly id: string }> };

export default async function CustomerPage({ params }: CustomerPageProps) {
  const app = daybook();
  await requireSession(app);
  const { id } = await params;
  const view = await customerScreen(app, id);
  if (view === undefined) {
    notFound();
  }

  const [orders, reminders] = await Promise.all([
    customerOrders(app, view.id),
    customerReminders(app, view.id),
  ]);

  return <CustomerScreen view={view} orders={orders} reminders={reminders} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomerForm } from "@/app/(app)/customers/customer-form";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { customerForm } from "@/features/customers/web/commands";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { Screen } from "@/shared/ui/screen/screen";
import { customerPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: customersCopy.edit };

// The form shows the customer as stored now, with the version a save sends back
export const dynamic = "force-dynamic";

type EditCustomerPageProps = { readonly params: Promise<{ readonly id: string }> };

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const app = daybook();
  await requireSession(app);
  const { id } = await params;
  const form = await customerForm(app, id);
  if (form?.customer === undefined) {
    notFound();
  }

  return (
    <Screen title={customersCopy.edit} back={customerPath(form.customer.id)}>
      <CustomerForm customer={form.customer} kinds={form.kinds} />
    </Screen>
  );
}

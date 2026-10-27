import type { Metadata } from "next";

import { CustomerForm } from "@/app/(app)/customers/customer-form";
import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { customerForm } from "@/features/customers/web/commands";
import type { KindView } from "@/features/customers/web/customer-view";
import { customersCopy } from "@/features/customers/web/customers-copy";
import { Screen } from "@/shared/ui/screen/screen";
import { routes } from "@/shared/web/routes";

export const metadata: Metadata = { title: customersCopy.add };

// The kinds to choose from change in Settings
export const dynamic = "force-dynamic";

const noKinds: ReadonlyArray<KindView> = [];

export default async function NewCustomerPage() {
  const app = daybook();
  await requireSession(app);
  const form = await customerForm(app);

  return (
    <Screen title={customersCopy.add} back={routes.customers}>
      <CustomerForm customer={undefined} kinds={form?.kinds ?? noKinds} />
    </Screen>
  );
}

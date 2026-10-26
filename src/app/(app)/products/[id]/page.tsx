import { notFound } from "next/navigation";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { productOrders } from "@/features/orders/web/commands";
import { productScreen } from "@/features/products/web/commands";

import { ProductScreen } from "./product-screen";

// Its orders and last price change with every order
export const dynamic = "force-dynamic";

type ProductPageProps = { readonly params: Promise<{ readonly id: string }> };

export default async function ProductPage({ params }: ProductPageProps) {
  const app = daybook();
  await requireSession(app);
  const { id } = await params;
  const view = await productScreen(app, id);
  if (view === undefined) {
    notFound();
  }

  return <ProductScreen view={view} orders={await productOrders(app, view.id)} />;
}

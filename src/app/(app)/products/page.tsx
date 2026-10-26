import type { Metadata } from "next";

import { daybook } from "@/composition/daybook";
import { requireSession } from "@/features/access/web/session-gate";
import { productsScreen } from "@/features/products/web/commands";
import { productsCopy } from "@/features/products/web/products-copy";

import { ProductsScreen } from "./products-screen";

export const metadata: Metadata = { title: productsCopy.title };

// What sold and at what price changes with every order
export const dynamic = "force-dynamic";

type ProductsPageProps = {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const app = daybook();
  await requireSession(app);
  const { q, hidden } = await searchParams;

  return <ProductsScreen view={await productsScreen(app, { q, hidden })} />;
}

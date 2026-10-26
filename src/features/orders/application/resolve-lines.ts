import type { Temporal } from "temporal-polyfill/implementation";

import type { OrderLine } from "@/features/orders/domain/order";
import * as Products from "@/features/products/domain/product";
import type { ActiveProduct, ProductId } from "@/features/products/domain/product";
import type { ProductRepository } from "@/features/products/domain/product-repository";
import type { AccountId } from "@/shared/domain/account-id";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchText } from "@/shared/domain/search-text";

import type { LineInput } from "./order-input";

export type ResolvedLines = {
  readonly lines: ReadonlyArray<OrderLine>;
  // Named for the first time; written in the same batch as the order
  readonly created: ReadonlyArray<ActiveProduct>;
};

// Turns the form's lines into order lines. A name matching an active product's name or another name it is known by,
// ignoring case and diacritics, is that product; any other name is a new one, made once even if two lines name it.
export async function resolveLines(
  products: ProductRepository,
  lines: ReadonlyArray<LineInput>,
  by: AccountId,
  at: Temporal.Instant,
): Promise<Result<ResolvedLines, "product_not_found">> {
  const ids = new Set(lines.flatMap((line) => ("id" in line.product ? [line.product.id] : [])));
  const names = lines.flatMap((line) => ("name" in line.product ? [line.product.name] : []));

  const known = await products.getMany([...ids]);
  if (known.length !== ids.size) {
    return err("product_not_found");
  }

  const byName = new Map<string, ProductId>(
    [...(await products.findActiveNamed(names))].map(([name, product]) => [name, product.id]),
  );
  const created: ActiveProduct[] = [];
  for (const name of names) {
    if (!byName.has(searchText(name))) {
      const product = Products.create(name, by, at);
      byName.set(searchText(name), product.id);
      created.push(product);
    }
  }

  return ok({
    lines: lines.map((line) => ({
      productId: "id" in line.product ? line.product.id : productNamed(byName, line.product.name),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    created,
  });
}

function productNamed(byName: ReadonlyMap<string, ProductId>, name: string): ProductId {
  const id = byName.get(searchText(name));
  if (id === undefined) {
    throw new Error(`Every name was resolved above, yet "${name}" was not`);
  }

  return id;
}

import type { App } from "@/composition/create-app";
import {
  productErrorMessages,
  type ProductError,
} from "@/features/products/application/product-errors";
import {
  productIdSchema,
  productNameSchema,
  type Product,
  type ProductName,
} from "@/features/products/domain/product";
import { productAliasIdSchema } from "@/features/products/domain/product-alias";
import type { AccountId } from "@/shared/domain/account-id";
import { versionSchema } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { searchTermSchema } from "@/shared/domain/search-term";

import type { ProductScreenView, ProductsView } from "./product-view";
import { orderCountText } from "./products-copy";

// The product screens' work, minus the framework: parse what the browser sent, call the app, answer with a view or
// the sentence the user reads. Server actions and pages wrap these; tests call them directly.

export async function productsScreen(
  app: App,
  params: { readonly q?: unknown; readonly hidden?: unknown },
): Promise<ProductsView> {
  const query = typeof params.q === "string" ? params.q : "";
  const term = searchTermSchema.safeParse(query);
  const showingHidden = params.hidden === "1";

  const [found, usage] = await Promise.all([
    app.listProducts({
      search: term.success ? term.data : undefined,
      status: showingHidden ? "archived" : "active",
    }),
    app.productUsage(),
  ]);

  return {
    query,
    showingHidden,
    rows: found.products.map((product) => {
      const used = usage.get(product.id);
      return {
        id: product.id,
        name: product.name,
        detail: used === undefined ? undefined : orderCountText(used.orderCount),
        lastPrice: used?.lastPrice,
      };
    }),
    more: found.more,
    filtered: term.success,
  };
}

export async function productScreen(app: App, id: unknown): Promise<ProductScreenView | undefined> {
  const productId = productIdSchema.safeParse(id);
  if (!productId.success) {
    return undefined;
  }

  const [product, usage, aliases] = await Promise.all([
    app.getProduct(productId.data),
    app.productUsage(),
    app.productAliases(productId.data),
  ]);
  if (product === undefined) {
    return undefined;
  }
  const used = usage.get(product.id);

  return {
    id: product.id,
    name: product.name,
    version: product.audit.version,
    hidden: product.status === "archived",
    mergedInto: product.status === "archived" ? product.mergedInto : undefined,
    lastPrice: used?.lastPrice,
    orderCount: used?.orderCount ?? 0,
    otherNames: aliases.map((alias) => ({ id: alias.id, name: alias.name })),
  };
}

function parseName(name: unknown): Result<ProductName, string> {
  const parsed = productNameSchema.safeParse(name);

  return parsed.success
    ? ok(parsed.data)
    : err(parsed.error.issues[0]?.message ?? productErrorMessages.product_not_found);
}

function refusal(error: ProductError): string {
  return productErrorMessages[error];
}

// Answers the new product's id
export async function addProduct(
  app: App,
  by: AccountId,
  name: unknown,
): Promise<Result<string, string>> {
  const parsed = parseName(name);
  if (!parsed.ok) {
    return parsed;
  }

  const added = await app.addProduct({ by, name: parsed.value });

  return added.ok ? ok(added.value.id) : err(refusal(added.error));
}

// A change answers the product's new version, for an Undo right after it, or the sentence to show
export type ProductChangeResult = Result<number, string>;

function parseChange(by: AccountId, id: unknown, version: unknown) {
  const productId = productIdSchema.safeParse(id);
  const shown = versionSchema.safeParse(version);

  return productId.success && shown.success
    ? { id: productId.data, by, shown: shown.data }
    : undefined;
}

function answered(result: Result<Product, ProductError>): ProductChangeResult {
  return result.ok ? ok(result.value.audit.version) : err(refusal(result.error));
}

export async function renameProduct(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
  name: unknown,
): Promise<ProductChangeResult> {
  const change = parseChange(by, id, version);
  if (change === undefined) {
    return err(productErrorMessages.product_not_found);
  }
  const parsed = parseName(name);
  if (!parsed.ok) {
    return parsed;
  }

  return answered(await app.renameProduct({ ...change, name: parsed.value }));
}

export async function archiveProduct(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<ProductChangeResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(productErrorMessages.product_not_found)
    : answered(await app.archiveProduct(change));
}

export async function restoreProduct(
  app: App,
  by: AccountId,
  id: unknown,
  version: unknown,
): Promise<ProductChangeResult> {
  const change = parseChange(by, id, version);

  return change === undefined
    ? err(productErrorMessages.product_not_found)
    : answered(await app.restoreProduct(change));
}

export async function addProductAlias(
  app: App,
  by: AccountId,
  productId: unknown,
  name: unknown,
): Promise<Result<null, string>> {
  const id = productIdSchema.safeParse(productId);
  if (!id.success) {
    return err(productErrorMessages.product_not_found);
  }
  const parsed = parseName(name);
  if (!parsed.ok) {
    return parsed;
  }

  const added = await app.addProductAlias({ by, productId: id.data, name: parsed.value });

  return added.ok ? ok(null) : err(refusal(added.error));
}

export async function removeProductAlias(
  app: App,
  aliasId: unknown,
): Promise<Result<null, string>> {
  const id = productAliasIdSchema.safeParse(aliasId);
  if (!id.success) {
    return err(productErrorMessages.alias_not_found);
  }

  const removed = await app.removeProductAlias(id.data);

  return removed.ok ? ok(null) : err(refusal(removed.error));
}

import { describe, expect, it } from "vitest";

import type { App } from "@/composition/create-app";
import type { LiveOrder } from "@/features/orders/domain/order";
import { productNameSchema, type ProductId } from "@/features/products/domain/product";
import { searchTermSchema } from "@/shared/domain/search-term";
import { changeOf, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

function anApp() {
  return testApp(testClock("2026-10-26T02:00:00Z").clock);
}

function name(text: string) {
  return productNameSchema.parse(text);
}

async function aProduct(app: App, text: string) {
  return expectOk(await app.addProduct({ by: await theAuthor(), name: name(text) }));
}

async function shown(app: App, search?: string) {
  const found = await app.listProducts({
    status: "active",
    search: search === undefined ? undefined : searchTermSchema.parse(search),
  });

  return found.products.map((product) => product.name);
}

// The product an order's first line sold
function firstProduct(order: LiveOrder): ProductId {
  const [first] = order.lines;
  if (first === undefined) {
    throw new Error("The order has no lines");
  }

  return first.productId;
}

async function anotherName(app: App, productId: ProductId, text: string) {
  return app.addProductAlias({ by: await theAuthor(), productId, name: name(text) });
}

describe("products", () => {
  it("given products, when listed or searched without accents, then they come by name and by every word", async () => {
    const app = anApp();
    await aProduct(app, "Thuốc tê Lidocaine");
    await aProduct(app, "Bông gòn");
    await aProduct(app, "Kim nha khoa");

    expect(await shown(app)).toEqual(["Bông gòn", "Kim nha khoa", "Thuốc tê Lidocaine"]);
    expect(await shown(app, "thuoc te")).toEqual(["Thuốc tê Lidocaine"]);
  });

  it("given a product, when another is added or renamed to its name in other letters, then it is refused", async () => {
    const app = anApp();
    await aProduct(app, "Thuốc tê");
    const gauze = await aProduct(app, "Bông gòn");
    const by = await theAuthor();

    expect(await app.addProduct({ by, name: name("thuoc TE") })).toEqual({
      ok: false,
      error: "product_name_taken",
    });
    expect(await app.renameProduct({ ...changeOf(gauze, by), name: name("Thuốc Tê") })).toEqual({
      ok: false,
      error: "product_name_taken",
    });
  });

  it("given a product, when renamed, then an order that sold it shows the new name, and a rename from an old screen is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const order = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("thuốc tê", 1, 100_000),
    ]);
    const product = await app.getProduct(firstProduct(order));
    if (product === undefined) {
      throw new Error("The order's product is missing");
    }

    const renamed = expectOk(
      await app.renameProduct({ ...changeOf(product, by), name: name("Thuốc tê Lidocaine") }),
    );

    expect((await app.getProducts([product.id]))[0]?.name).toBe("Thuốc tê Lidocaine");
    expect(renamed.audit.version).toBe(2);
    expect(await app.renameProduct({ ...changeOf(product, by), name: name("Khác") })).toEqual({
      ok: false,
      error: "product_changed_elsewhere",
    });
  });

  it("given a hidden product, when listed, then it is only among the hidden; shown again, it is back, unless its name was taken meanwhile", async () => {
    const app = anApp();
    const by = await theAuthor();
    const product = await aProduct(app, "Bông gòn");

    const hidden = expectOk(await app.archiveProduct(changeOf(product, by)));
    expect(await shown(app)).toEqual([]);
    expect(
      (await app.listProducts({ status: "archived" })).products.map((each) => each.name),
    ).toEqual(["Bông gòn"]);

    await aProduct(app, "bong gon");
    expect(await app.restoreProduct(changeOf(hidden, by))).toEqual({
      ok: false,
      error: "product_name_taken",
    });
  });

  it("given a product with another name, when an order line names it by that name, then it is that product, not a new one", async () => {
    const app = anApp();
    const product = await aProduct(app, "Thuốc tê Lidocaine");
    expectOk(await anotherName(app, product.id, "gel tê"));

    const order = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("Gel Te", 2, 50_000),
    ]);

    expect(firstProduct(order)).toBe(product.id);
    expect(await shown(app, "gel")).toEqual(["Thuốc tê Lidocaine"]);
  });

  it("given names in use, when another name repeats a product's name or another product's other name, then it is refused", async () => {
    const app = anApp();
    const anaesthetic = await aProduct(app, "Thuốc tê");
    const gauze = await aProduct(app, "Bông gòn");
    expectOk(await anotherName(app, anaesthetic.id, "gel tê"));

    expect(await anotherName(app, gauze.id, "THUOC TE")).toEqual({
      ok: false,
      error: "alias_taken",
    });
    expect(await anotherName(app, gauze.id, "Gel tê")).toEqual({
      ok: false,
      error: "alias_taken",
    });
    expect(await app.addProduct({ by: await theAuthor(), name: name("gel te") })).toEqual({
      ok: false,
      error: "product_name_taken",
    });
  });

  it("given another name, when removed, then an order line naming it makes a new product again", async () => {
    const app = anApp();
    const product = await aProduct(app, "Thuốc tê");
    const alias = expectOk(await anotherName(app, product.id, "gel tê"));

    expectOk(await app.removeProductAlias(alias.id));

    expect(await app.productAliases(product.id)).toEqual([]);
    const order = await anOrder(app, await aCustomer(app, "Hướng Dương"), [
      line("gel tê", 1, 10_000),
    ]);
    expect(firstProduct(order)).not.toBe(product.id);
    expect(await app.removeProductAlias(alias.id)).toEqual({
      ok: false,
      error: "alias_not_found",
    });
  });

  it("given live and deleted orders, when usage is read, then each product counts its live orders and its latest price", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = await aCustomer(app, "Hướng Dương");
    const first = await anOrder(app, customer, [line("Kim", 1, 10_000)], "2026-10-20");
    await anOrder(app, customer, [line("Kim", 2, 12_000)], "2026-10-24");
    const deleted = await anOrder(app, customer, [line("Kim", 1, 99_000)], "2026-10-25");
    expectOk(await app.deleteOrder(changeOf(deleted, by)));

    const usage = await app.productUsage();

    expect(usage.get(firstProduct(first))).toEqual({
      orderCount: 2,
      lastPrice: 12_000,
    });
  });
});

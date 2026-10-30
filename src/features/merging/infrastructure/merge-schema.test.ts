import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { productNameSchema } from "@/features/products/domain/product";
import { changeOf, testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

// Guards the hand-written parts of the merges-and-aliases migration that the use cases never exercise: what a
// hand-written query could otherwise do

async function twoCustomersMerged() {
  const app = testApp(testClock("2026-10-26T02:00:00Z").clock);
  const kept = await aCustomer(app, "Nha khoa Lan Anh");
  const merged = await aCustomer(app, "chị Lan");
  expectOk(await app.mergeCustomers({ ...changeOf(merged, await theAuthor()), into: kept.id }));

  return { app, kept, merged };
}

describe("tables of the migration", () => {
  it.each(["customer_alias", "product_alias", "customer_merge", "product_merge", "order_change"])(
    "given the schema, when %s is read, then it is STRICT",
    async (table) => {
      const { results } = await env.DB.prepare("pragma table_list").all<{
        name: string;
        strict: number;
      }>();

      expect(results.find((each) => each.name === table)?.strict).toBe(1);
    },
  );
});

describe("customer_merge table", () => {
  it("given a merge, when rewritten, then the trigger refuses", async () => {
    await twoCustomersMerged();

    await expect(env.DB.prepare("update customer_merge set moved = '{}'").run()).rejects.toThrow(
      /customer_merge is append-only/,
    );
  });

  it("given a merge into a customer still in use, when deleted, then the trigger refuses", async () => {
    await twoCustomersMerged();

    await expect(env.DB.prepare("delete from customer_merge").run()).rejects.toThrow(
      /customer_merge goes only with the customers it joined/,
    );
  });
});

describe("customer table", () => {
  it("given a customer in use, when it is made to name another as merged into, then the trigger refuses", async () => {
    const { app, kept } = await twoCustomersMerged();
    const other = await aCustomer(app, "Sao Mai");

    await expect(
      env.DB.prepare("update customer set merged_into_id = ?, version = version + 1 where id = ?")
        .bind(kept.id, other.id)
        .run(),
    ).rejects.toThrow(/merged_only_hidden/);
  });

  it("given a merged customer, when it is made to name itself, then the trigger refuses", async () => {
    const { merged } = await twoCustomersMerged();

    await expect(
      env.DB.prepare("update customer set merged_into_id = id, version = version + 1 where id = ?")
        .bind(merged.id)
        .run(),
    ).rejects.toThrow(/merged_only_hidden/);
  });
});

async function aProduct(name: string) {
  const app = testApp(testClock("2026-10-26T02:00:00Z").clock);

  return expectOk(
    await app.addProduct({ by: await theAuthor(), name: productNameSchema.parse(name) }),
  );
}

describe("product table", () => {
  it("given a product in use, when it is made to name another as merged into, then the trigger refuses", async () => {
    const first = await aProduct("Thuốc tê");
    const second = await aProduct("Bông gòn");

    await expect(
      env.DB.prepare("update product set merged_into_id = ?, version = version + 1 where id = ?")
        .bind(first.id, second.id)
        .run(),
    ).rejects.toThrow(/merged_only_hidden/);
  });
});

describe("alias tables", () => {
  it("given a product's other name, when another product is given the same one by hand, then the index refuses", async () => {
    const insert =
      "insert into product_alias (id, product_id, name, search_name, created_at, created_by) select ?, id, 'gel', 'gel', 1, created_by from product where name = ?";
    await aProduct("Thuốc tê");
    await aProduct("Bông gòn");
    await env.DB.prepare(insert).bind("019a0000-0000-7000-8000-00000000e001", "Thuốc tê").run();

    await expect(
      env.DB.prepare(insert).bind("019a0000-0000-7000-8000-00000000e002", "Bông gòn").run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it("given a customer's other name, when the same customer is given it again by hand, then the index refuses", async () => {
    const { kept } = await twoCustomersMerged();
    const insert =
      "insert into customer_alias (id, customer_id, name, search_name, created_at, created_by) select ?, id, 'chị Lan', 'chi lan', 1, created_by from customer where id = ?";

    await expect(
      env.DB.prepare(insert).bind("019a0000-0000-7000-8000-00000000e003", kept.id).run(),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });
});

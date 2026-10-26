import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";
import { expectOk } from "@/testing/support/result";

import * as Products from "./product";
import { productNameSchema } from "./product";

const maker = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000a1");
const at = Temporal.Instant.from("2026-10-26T02:00:00Z");

function aProduct(name: string) {
  return Products.create(productNameSchema.parse(name), maker, at);
}

describe("Products", () => {
  it("given a product, when hidden and shown again, then it is back as it was, with two more versions", () => {
    const product = aProduct("Bông gòn");

    const hidden = expectOk(Products.archive(product, maker, at));
    const shown = expectOk(Products.restore(hidden, maker, at));

    expect(hidden.mergedInto).toBeUndefined();
    expect(shown).toEqual({ ...product, audit: { ...product.audit, version: 3 } });
    expect(Products.archive(hidden, maker, at)).toEqual({ ok: false, error: "product_archived" });
  });

  it("given two products, when one is merged into the other, then it is hidden naming the kept one, for good", () => {
    const kept = aProduct("Thuốc tê");
    const product = aProduct("gel tê");

    const merged = expectOk(Products.mergeInto(product, kept, maker, at));

    expect(merged).toMatchObject({ status: "archived", mergedInto: kept.id });
    expect(Products.restore(merged, maker, at)).toEqual({ ok: false, error: "product_merged" });
    expect(Products.mergeInto(merged, kept, maker, at)).toEqual({
      ok: false,
      error: "product_merged",
    });
    expect(Products.mergeInto(kept, kept, maker, at)).toEqual({
      ok: false,
      error: "merge_into_itself",
    });
  });

  it("given a hidden product, when merged, then it keeps when it was hidden", () => {
    const earlier = Temporal.Instant.from("2026-10-01T00:00:00Z");
    const hidden = expectOk(Products.archive(aProduct("gel tê"), maker, earlier));

    const merged = expectOk(Products.mergeInto(hidden, aProduct("Thuốc tê"), maker, at));

    expect(merged.archival.archivedAt).toEqual(earlier);
  });
});

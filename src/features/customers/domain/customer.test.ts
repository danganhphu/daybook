import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { accountIdSchema } from "@/shared/domain/account-id";
import { expectOk } from "@/testing/support/result";

import * as Customers from "./customer";
import { customerDetailsSchema } from "./customer";

const maker = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000a1");
const editor = accountIdSchema.parse("019a0000-0000-7000-8000-0000000000b2");
const created = Temporal.Instant.from("2026-10-23T01:00:00Z");
const later = Temporal.Instant.from("2026-10-23T02:00:00Z");

function details(fields: Record<string, unknown> = {}) {
  return customerDetailsSchema.parse({ name: "Nha khoa Hướng Dương", ...fields });
}

describe("customerDetailsSchema", () => {
  it("given a name typed with spaces around it, when read, then it is trimmed and the empty details are left out", () => {
    expect(
      customerDetailsSchema.parse({ name: "  Hướng Dương ", area: " ", phone: "", note: "" }),
    ).toEqual({
      name: "Hướng Dương",
      area: undefined,
      phone: undefined,
      address: undefined,
      note: undefined,
    });
  });

  it("given a name typed with combining marks, when read, then it is the same text as one typed precomposed", () => {
    expect(details({ name: "Hướng" }).name).toBe("Hướng");
  });

  it.each([
    [{ name: " " }, "Chưa nhập tên khách"],
    [{ name: "x".repeat(101) }, "Tên khách tối đa 100 ký tự"],
    [{ phone: "gọi sau" }, "Số điện thoại chỉ gồm số"],
    [{ area: "x".repeat(61) }, "Khu vực tối đa 60 ký tự"],
  ])("given %j, when read, then it says %s", (fields, message) => {
    const parsed = customerDetailsSchema.safeParse({ name: "Hướng Dương", ...fields });

    expect(parsed.error?.issues[0]?.message).toBe(message);
  });

  it("given a phone with spaces, dots and a country code, when read, then it is kept as typed", () => {
    expect(details({ phone: "+84 90.123 4567" }).phone).toBe("+84 90.123 4567");
  });
});

describe("Customers", () => {
  it("given a new customer, when the other person revises it, then the details change and the creation stays", () => {
    const customer = Customers.create(details(), maker, created);

    const revised = Customers.revise(customer, details({ area: "Quận 3" }), editor, later);

    expect(revised.area).toBe("Quận 3");
    expect(revised.audit).toEqual({
      createdAt: created,
      createdBy: maker,
      updatedAt: later,
      updatedBy: editor,
      version: 2,
    });
  });

  it("given a customer, when archived and restored, then it is back as it was, with two more versions", () => {
    const customer = Customers.create(details({ area: "Quận 3" }), maker, created);

    const archived = expectOk(Customers.archive(customer, editor, later));
    const restored = expectOk(Customers.restore(archived, maker, later));

    expect(archived.archival).toEqual({ archivedAt: later, archivedBy: editor });
    expect(restored).toEqual({
      ...customer,
      audit: { ...customer.audit, updatedAt: later, updatedBy: maker, version: 3 },
    });
    expect(restored).not.toHaveProperty("archival");
  });

  it("given an archived customer, when archived again, then it refuses; a customer in use cannot be restored", () => {
    const customer = Customers.create(details(), maker, created);
    const archived = expectOk(Customers.archive(customer, maker, later));

    expect(Customers.archive(archived, maker, later)).toEqual({
      ok: false,
      error: "customer_archived",
    });
    expect(Customers.restore(customer, maker, later)).toEqual({
      ok: false,
      error: "customer_not_archived",
    });
  });

  it("given two customers, when one is merged into the other, then it is hidden naming the kept one, for good, and the kept one's version moves", () => {
    const kept = Customers.create(details({ name: "Nha khoa Lan Anh" }), maker, created);
    const customer = Customers.create(details({ name: "chị Lan" }), maker, created);

    const merged = expectOk(Customers.mergeInto(customer, kept, editor, later));

    expect(merged).toMatchObject({ status: "archived", mergedInto: kept.id });
    expect(Customers.restore(merged, maker, later)).toEqual({
      ok: false,
      error: "customer_merged",
    });
    expect(Customers.mergeInto(kept, kept, maker, later)).toEqual({
      ok: false,
      error: "merge_into_itself",
    });
    expect(Customers.absorbMerge(kept, editor, later).audit).toMatchObject({
      version: 2,
      updatedBy: editor,
    });
  });
});

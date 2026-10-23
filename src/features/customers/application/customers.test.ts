import { describe, expect, it } from "vitest";

import { customerDetailsSchema } from "@/features/customers/domain/customer";
import { customerKindIdSchema, kindNameSchema } from "@/features/customers/domain/customer-kind";
import { searchTermSchema } from "@/shared/domain/search-text";
import { changeOf, testApp, testClock, theAuthor, thePartner } from "@/testing/support/app";
import { expectOk } from "@/testing/support/result";

function details(fields: Record<string, unknown> = {}) {
  return customerDetailsSchema.parse({ name: "Nha khoa Hướng Dương", ...fields });
}

function anApp() {
  return testApp(testClock("2026-10-23T01:00:00Z").clock);
}

async function aKind(app: ReturnType<typeof anApp>, text: string) {
  return expectOk(
    await app.addCustomerKind({ by: await theAuthor(), name: kindNameSchema.parse(text) }),
  );
}

async function names(app: ReturnType<typeof anApp>, search?: string) {
  const found = await app.listCustomers({
    status: "active",
    search: search === undefined ? undefined : searchTermSchema.parse(search),
  });

  return found.customers.map((customer) => customer.name);
}

describe("customers", () => {
  it("given customers, when listed, then they come by name, accents sorting beside their plain letters", async () => {
    const app = anApp();
    const by = await theAuthor();
    for (const name of ["Bình Minh", "Ánh Dương", "Anh Đào", "Zen"]) {
      // oxlint-disable-next-line no-await-in-loop -- order of adding does not matter
      expectOk(await app.addCustomer({ by, details: details({ name }) }));
    }

    expect(await names(app)).toEqual(["Anh Đào", "Ánh Dương", "Bình Minh", "Zen"]);
  });

  it("given customers, when searched by name or area without accents, then only those holding every word are found", async () => {
    const app = anApp();
    const by = await theAuthor();
    expectOk(
      await app.addCustomer({ by, details: details({ name: "Hướng Dương", area: "Quận 3" }) }),
    );
    expectOk(
      await app.addCustomer({ by, details: details({ name: "Hướng Dương", area: "Thủ Đức" }) }),
    );
    expectOk(await app.addCustomer({ by, details: details({ name: "Sao Mai", area: "Quận 3" }) }));

    expect(await names(app, "huong quan 3")).toEqual(["Hướng Dương"]);
    expect(await names(app, "thu duc")).toEqual(["Hướng Dương"]);
    expect(await names(app, "quan 3")).toHaveLength(2);
  });

  it("given customers of different kinds, when listed by kind, then only that kind's are there", async () => {
    const app = anApp();
    const by = await theAuthor();
    const clinic = await aKind(app, "Nha khoa");
    const agent = await aKind(app, "Đại lý");
    expectOk(
      await app.addCustomer({ by, details: details({ name: "Sao Mai", kindId: clinic.id }) }),
    );
    expectOk(
      await app.addCustomer({ by, details: details({ name: "Hoà Bình", kindId: agent.id }) }),
    );

    const found = await app.listCustomers({ status: "active", kindId: agent.id });

    expect(found.customers.map((customer) => customer.name)).toEqual(["Hoà Bình"]);
  });

  it("given a kind that does not exist or is hidden, when a customer is added with it, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const hidden = await aKind(app, "Nha khoa");
    expectOk(await app.archiveCustomerKind(changeOf(hidden, by)));
    const missing = customerKindIdSchema.parse("019a0000-0000-7000-8000-000000000099");

    expect(await app.addCustomer({ by, details: details({ kindId: missing }) })).toEqual({
      ok: false,
      error: "kind_not_found",
    });
    expect(await app.addCustomer({ by, details: details({ kindId: hidden.id }) })).toEqual({
      ok: false,
      error: "kind_archived",
    });
  });

  it("given a customer whose kind was hidden later, when revised keeping that kind, then it is allowed", async () => {
    const app = anApp();
    const by = await theAuthor();
    const kind = await aKind(app, "Nha khoa");
    const customer = expectOk(await app.addCustomer({ by, details: details({ kindId: kind.id }) }));
    expectOk(await app.archiveCustomerKind(changeOf(kind, by)));

    const revised = expectOk(
      await app.reviseCustomer({
        ...changeOf(customer, by),
        details: details({ kindId: kind.id, phone: "0901234567" }),
      }),
    );

    expect(revised.kindId).toBe(kind.id);
    expect(revised.phone).toBe("0901234567");
  });

  it("given a customer revised on another device, when revised from the old screen, then it is refused", async () => {
    const app = anApp();
    const by = await theAuthor();
    const shown = expectOk(await app.addCustomer({ by, details: details() }));
    expectOk(
      await app.reviseCustomer({
        ...changeOf(shown, await thePartner()),
        details: details({ area: "Quận 3" }),
      }),
    );

    expect(
      await app.reviseCustomer({ ...changeOf(shown, by), details: details({ area: "Quận 1" }) }),
    ).toEqual({ ok: false, error: "customer_changed_elsewhere" });
    expect((await app.getCustomer(shown.id))?.area).toBe("Quận 3");
  });

  it("given a customer, when hidden, then it leaves the list and shows among the hidden; when restored, then it is back", async () => {
    const app = anApp();
    const by = await theAuthor();
    const customer = expectOk(await app.addCustomer({ by, details: details() }));

    const archived = expectOk(await app.archiveCustomer(changeOf(customer, by)));
    const hidden = await app.listCustomers({ status: "archived" });

    expect(await names(app)).toEqual([]);
    expect(hidden.customers.map((found) => found.id)).toEqual([customer.id]);

    expectOk(await app.restoreCustomer(changeOf(archived, by)));
    expect(await names(app)).toEqual(["Nha khoa Hướng Dương"]);
  });
});

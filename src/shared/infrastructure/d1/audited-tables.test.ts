import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { creationFixedMessage, staleVersionMessage } from "./audit-columns";

// Every table with a version column is audited (ADR 0011, decision 9). drizzle-kit writes neither STRICT nor
// triggers, so each migration adds them by hand; this finds a table where that was forgotten, today's and tomorrow's.
// D1 refuses the pragma table functions, so the pragmas run as statements.

type TableListRow = { readonly name: string; readonly type: string; readonly strict: number };

async function auditedTables(): Promise<ReadonlyArray<TableListRow>> {
  const { results: tables } = await env.DB.prepare("pragma table_list").all<TableListRow>();
  const audited: TableListRow[] = [];
  for (const table of tables) {
    if (table.type !== "table" || !/^[a-z_]+$/.test(table.name)) {
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- a pragma takes no parameters, so one table per statement
    const { results: columns } = await env.DB.prepare(`pragma table_info(${table.name})`).all<{
      name: string;
    }>();
    if (columns.some((column) => column.name === "version")) {
      audited.push(table);
    }
  }

  return audited.toSorted((a, b) => a.name.localeCompare(b.name));
}

async function triggersOn(table: string) {
  const { results } = await env.DB.prepare(
    "select name, sql from sqlite_master where type = 'trigger' and tbl_name = ? order by name",
  )
    .bind(table)
    .all<{ readonly name: string; readonly sql: string }>();

  return new Map(results.map((trigger) => [trigger.name, trigger.sql]));
}

describe("audited tables", () => {
  it("given the schema, when read, then the known audited tables are among them", async () => {
    expect((await auditedTables()).map((table) => table.name)).toEqual(
      expect.arrayContaining(["customer", "customer_kind", "note"]),
    );
  });

  it("given every audited table, when read, then it is STRICT and keeps both audit triggers", async () => {
    for (const table of await auditedTables()) {
      // oxlint-disable-next-line no-await-in-loop -- one table at a time keeps the failure message readable
      const triggers = await triggersOn(table.name);

      // The table's name in the object, so a failure says which one
      expect({
        table: table.name,
        strict: table.strict === 1,
        refusesStaleVersions:
          triggers.get(`${table.name}_version_moves_by_one`)?.includes(staleVersionMessage) ===
          true,
        keepsCreation:
          triggers.get(`${table.name}_creation_is_fixed`)?.includes(creationFixedMessage) === true,
      }).toEqual({
        table: table.name,
        strict: true,
        refusesStaleVersions: true,
        keepsCreation: true,
      });
    }
  });
});

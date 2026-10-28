import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Guards what the book settings migration adds by hand - STRICT - and the checks that keep the rules in the database as
// well as in code. The audited table's triggers are checked with every other audited table.

const accountId = "019a0000-0000-7000-8000-000000000001";

function run(sql: string, ...values: ReadonlyArray<unknown>) {
  return env.DB.prepare(sql)
    .bind(...values)
    .run();
}

async function seedAccount() {
  await run(
    "insert into account (id, username, display_name, webauthn_user_handle, created_at, updated_at) values (?, 'lan', 'Lan', ?, 1, 1)",
    accountId,
    "H".repeat(43),
  );
}

function insertSetting(id: number, quietAfterDays: number) {
  return run(
    "insert into book_setting values (?, ?, 1, ?, 1, ?, 1)",
    id,
    quietAfterDays,
    accountId,
    accountId,
  );
}

describe("book_setting table", () => {
  it("given text in an integer column, when inserted, then STRICT refuses it", async () => {
    await expect(
      run("insert into book_setting values (1, 21, 'soon', 'a', 1, 'a', 1)"),
    ).rejects.toThrow(/cannot store TEXT value in INTEGER column/);
  });

  it.each([6, 181])(
    "given %i days, when stored, then the range check refuses them",
    async (days) => {
      await seedAccount();

      await expect(insertSetting(1, days)).rejects.toThrow(/book_setting_quiet_after_days_range/);
    },
  );

  it("given a second row, when stored, then the check refuses it", async () => {
    await seedAccount();

    await expect(insertSetting(2, 21)).rejects.toThrow(/book_setting_single/);
  });
});

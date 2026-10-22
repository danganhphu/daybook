import { sql } from "drizzle-orm";
import { SQLiteDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { sqlNumber, sqlNumberList, sqlTextList } from "./sql-literals";

const dialect = new SQLiteDialect();

describe("sqlNumber and sqlNumberList", () => {
  it("given domain numbers, when written into a CHECK, then they are plain text with no parameters", () => {
    expect(dialect.sqlToQuery(sql`length(x) = ${sqlNumber(43)}`)).toEqual({
      sql: "length(x) = 43",
      params: [],
    });
    expect(dialect.sqlToQuery(sql`x in (${sqlNumberList([-7, -8, -257])})`)).toEqual({
      sql: "x in (-7, -8, -257)",
      params: [],
    });
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "given %s, when asked for, then it is refused",
    (value) => {
      expect(() => sqlNumber(value)).toThrow(RangeError);
    },
  );
});

describe("sqlTextList", () => {
  it("given plain codes, when written into a CHECK, then each is quoted once", () => {
    expect(dialect.sqlToQuery(sql`x in (${sqlTextList(["first_setup", "invite"])})`)).toEqual({
      sql: "x in ('first_setup', 'invite')",
      params: [],
    });
  });

  it.each(["it's", "a' or '1'='1", "Upper", "with space"])(
    "given %s, when asked for, then it is refused before it reaches the statement",
    (value) => {
      expect(() => sqlTextList([value])).toThrow(RangeError);
    },
  );
});

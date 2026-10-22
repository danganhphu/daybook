import { sql, type SQL } from "drizzle-orm";

// Values from the domain inside a CHECK constraint. DDL takes no parameters, so they are written into the statement;
// each is checked first, so nothing but a number or a plain code can get in.

export function sqlNumber(value: number): SQL {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Not a safe integer for a CHECK constraint: ${value}`);
  }

  return sql.raw(String(value));
}

// -7, -8, -257 - a closed set of numbers
export function sqlNumberList(values: ReadonlyArray<number>): SQL {
  return sql.join(values.map(sqlNumber), sql.raw(", "));
}

// 'a', 'b', 'c' - the codes a closed set of kinds is stored as
export function sqlTextList(values: ReadonlyArray<string>): SQL {
  for (const value of values) {
    if (!/^[a-z0-9_]+$/.test(value)) {
      throw new RangeError(`Not a plain code for a CHECK constraint: ${value}`);
    }
  }

  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}

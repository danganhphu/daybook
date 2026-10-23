import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

// The escape character every pattern here uses, so % and _ typed by a person match themselves
const escape = "\\";

function escapeLike(text: string): string {
  return text
    .replaceAll(escape, `${escape}${escape}`)
    .replaceAll("%", `${escape}%`)
    .replaceAll("_", `${escape}_`);
}

// `column` contains `text` anywhere, matched literally. The pattern is a bound parameter; only the escape character
// is written into the statement.
export function containsLiterally(column: SQLWrapper, text: string): SQL {
  return sql`${column} like ${`%${escapeLike(text)}%`} escape ${sql.raw(`'${escape}'`)}`;
}

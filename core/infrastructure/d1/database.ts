import { drizzle } from "drizzle-orm/d1";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(d1: D1Database) {
  return drizzle(d1);
}

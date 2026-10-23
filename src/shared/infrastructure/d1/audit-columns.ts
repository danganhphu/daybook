import { sql } from "drizzle-orm";
import {
  check,
  integer,
  text,
  type AnySQLiteColumn,
  type SQLiteColumn,
} from "drizzle-orm/sqlite-core";

// The audit columns every record people edit carries (ADR 0011, decision 9), and the rules the database keeps for
// them. `account` is the column the actors point at; it is passed in, so shared code never names a feature's table.

export function auditColumns(account: () => AnySQLiteColumn) {
  return {
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by").notNull().references(account),
    updatedAt: integer("updated_at").notNull(),
    updatedBy: text("updated_by").notNull().references(account),
    version: integer("version").notNull(),
  };
}

export function deletionColumns(account: () => AnySQLiteColumn) {
  return {
    deletedAt: integer("deleted_at"),
    deletedBy: text("deleted_by").references(account),
  };
}

export function archivalColumns(account: () => AnySQLiteColumn) {
  return {
    archivedAt: integer("archived_at"),
    archivedBy: text("archived_by").references(account),
  };
}

type AuditedTable = {
  readonly createdAt: SQLiteColumn;
  readonly updatedAt: SQLiteColumn;
  readonly version: SQLiteColumn;
};

export function auditChecks(name: string, table: AuditedTable) {
  return [
    check(`${name}_version_positive`, sql`${table.version} >= 1`),
    check(`${name}_updated_after_created`, sql`${table.updatedAt} >= ${table.createdAt}`),
  ];
}

// Deleted by someone at some moment, or neither: never one without the other
export function deletionChecks(
  name: string,
  table: { readonly deletedAt: SQLiteColumn; readonly deletedBy: SQLiteColumn },
) {
  return [
    check(
      `${name}_deletion_whole`,
      sql`(${table.deletedAt} is null) = (${table.deletedBy} is null)`,
    ),
  ];
}

export function archivalChecks(
  name: string,
  table: { readonly archivedAt: SQLiteColumn; readonly archivedBy: SQLiteColumn },
) {
  return [
    check(
      `${name}_archival_whole`,
      sql`(${table.archivedAt} is null) = (${table.archivedBy} is null)`,
    ),
  ];
}

// What the hand-written triggers raise, so the batch can tell a stale write from any other refusal. Each audited table
// gets `<table>_version_moves_by_one` (an update must set version to the stored one plus one) and
// `<table>_creation_is_fixed` (created_at and created_by never change).
export const staleVersionMessage = "stale_version";
export const creationFixedMessage = "creation_is_fixed";

import { Temporal } from "temporal-polyfill/implementation";

import { accountIdSchema } from "@/shared/domain/account-id";
import { versionSchema, type Archival, type Audit, type Deletion } from "@/shared/domain/audit";

// Audit columns to and from their domain values; rows are parsed, so a value the checks let through still fails here

export type AuditRow = {
  readonly createdAt: number;
  readonly createdBy: string;
  readonly updatedAt: number;
  readonly updatedBy: string;
  readonly version: number;
};

export type DeletionRow = {
  readonly deletedAt: number | null;
  readonly deletedBy: string | null;
};

export function toAudit(row: AuditRow): Audit {
  return {
    createdAt: Temporal.Instant.fromEpochMilliseconds(row.createdAt),
    createdBy: accountIdSchema.parse(row.createdBy),
    updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updatedAt),
    updatedBy: accountIdSchema.parse(row.updatedBy),
    version: versionSchema.parse(row.version),
  };
}

export function toAuditRow(audit: Audit): AuditRow {
  return {
    createdAt: audit.createdAt.epochMilliseconds,
    createdBy: audit.createdBy,
    updatedAt: audit.updatedAt.epochMilliseconds,
    updatedBy: audit.updatedBy,
    version: audit.version,
  };
}

// Undefined for a live record
export function toDeletion(row: DeletionRow): Deletion | undefined {
  if (row.deletedAt === null || row.deletedBy === null) {
    return undefined;
  }

  return {
    deletedAt: Temporal.Instant.fromEpochMilliseconds(row.deletedAt),
    deletedBy: accountIdSchema.parse(row.deletedBy),
  };
}

export function toDeletionRow(deletion: Deletion | undefined): DeletionRow {
  return deletion === undefined
    ? { deletedAt: null, deletedBy: null }
    : { deletedAt: deletion.deletedAt.epochMilliseconds, deletedBy: deletion.deletedBy };
}

export type ArchivalRow = {
  readonly archivedAt: number | null;
  readonly archivedBy: string | null;
};

// Undefined for a record in use
export function toArchival(row: ArchivalRow): Archival | undefined {
  if (row.archivedAt === null || row.archivedBy === null) {
    return undefined;
  }

  return {
    archivedAt: Temporal.Instant.fromEpochMilliseconds(row.archivedAt),
    archivedBy: accountIdSchema.parse(row.archivedBy),
  };
}

export function toArchivalRow(archival: Archival | undefined): ArchivalRow {
  return archival === undefined
    ? { archivedAt: null, archivedBy: null }
    : { archivedAt: archival.archivedAt.epochMilliseconds, archivedBy: archival.archivedBy };
}

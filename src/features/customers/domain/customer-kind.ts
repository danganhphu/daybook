import type { Temporal } from "temporal-polyfill/implementation";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

import type { AccountId } from "@/shared/domain/account-id";
import * as Audits from "@/shared/domain/audit";
import type { Archival, Audit, Deletion } from "@/shared/domain/audit";
import { err, ok, type Result } from "@/shared/domain/result";
import { requiredTextSchema } from "@/shared/domain/short-text";

import { kindNameMaxLength } from "./customer-limits";

// Read as a module: `import * as CustomerKinds`. What kinds exist is the owner's data, typed into Settings; the code
// names none of them (ADR 0011, decision 4).

export const customerKindIdSchema = z.uuid().brand<"CustomerKindId">();

export type CustomerKindId = z.infer<typeof customerKindIdSchema>;

export const kindNameSchema = requiredTextSchema(kindNameMaxLength, {
  empty: "Chưa nhập tên loại khách",
  tooLong: `Tên loại khách tối đa ${kindNameMaxLength} ký tự`,
}).brand<"KindName">();

export type KindName = z.infer<typeof kindNameSchema>;

// Where it sits in lists: smaller first
export const positionSchema = z.number().int().min(0).brand<"KindPosition">();

export type KindPosition = z.infer<typeof positionSchema>;

type KindFields = {
  readonly id: CustomerKindId;
  readonly name: KindName;
  readonly position: KindPosition;
  readonly audit: Audit;
};

export type ActiveKind = KindFields & { readonly status: "active" };

export type ArchivedKind = KindFields & {
  readonly status: "archived";
  readonly archival: Archival;
  // Set when deleted: hidden by the same act, and in the trash; its customers read as having no kind meanwhile
  readonly deletion: Deletion | undefined;
};

export type CustomerKind = ActiveKind | ArchivedKind;

export function create(
  name: KindName,
  position: KindPosition,
  by: AccountId,
  at: Temporal.Instant,
): ActiveKind {
  return {
    status: "active",
    id: customerKindIdSchema.parse(uuidv7()),
    name,
    position,
    audit: Audits.start(by, at),
  };
}

export function rename(
  kind: CustomerKind,
  name: KindName,
  by: AccountId,
  at: Temporal.Instant,
): CustomerKind {
  return { ...kind, name, audit: Audits.change(kind.audit, by, at) };
}

// Customers keep the kind they had; it only stops being offered for new ones
export function archive(
  kind: CustomerKind,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedKind, "kind_archived"> {
  if (kind.status === "archived") {
    return err("kind_archived");
  }

  return ok({
    ...kind,
    status: "archived",
    audit: Audits.change(kind.audit, by, at),
    archival: Audits.archival(by, at),
    deletion: undefined,
  });
}

function shown(kind: ArchivedKind, by: AccountId, at: Temporal.Instant): ActiveKind {
  return {
    status: "active",
    id: kind.id,
    name: kind.name,
    position: kind.position,
    audit: Audits.change(kind.audit, by, at),
  };
}

// A deleted one comes back from the trash, not from the hidden list
export function restore(
  kind: CustomerKind,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveKind, "kind_not_archived" | "kind_deleted"> {
  if (kind.status === "active") {
    return err("kind_not_archived");
  }
  if (kind.deletion !== undefined) {
    return err("kind_deleted");
  }

  return ok(shown(kind, by, at));
}

// Into the trash, hidden by the same act. Its customers keep it, and read as having no kind until it comes back.
export function markDeleted(
  kind: CustomerKind,
  by: AccountId,
  at: Temporal.Instant,
): Result<ArchivedKind, "kind_deleted"> {
  if (kind.status === "archived" && kind.deletion !== undefined) {
    return err("kind_deleted");
  }

  return ok({
    ...kind,
    status: "archived",
    audit: Audits.change(kind.audit, by, at),
    archival: kind.status === "archived" ? kind.archival : Audits.archival(by, at),
    deletion: Audits.deletion(by, at),
  });
}

// Back from the trash, shown; the caller checks its name is still free, as for one shown again
export function restoreDeleted(
  kind: CustomerKind,
  by: AccountId,
  at: Temporal.Instant,
): Result<ActiveKind, "kind_not_deleted"> {
  if (kind.status === "active" || kind.deletion === undefined) {
    return err("kind_not_deleted");
  }

  return ok(shown(kind, by, at));
}

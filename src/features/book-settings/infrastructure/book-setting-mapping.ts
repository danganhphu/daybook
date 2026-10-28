import {
  quietAfterDaysSchema,
  type BookSetting,
} from "@/features/book-settings/domain/book-setting";
import { toAudit, toAuditRow } from "@/shared/infrastructure/d1/audit-mapping";

import { bookSettingId, type bookSettingTable } from "./book-setting.table";

type BookSettingRow = typeof bookSettingTable.$inferSelect;

export function toBookSetting(row: BookSettingRow): BookSetting {
  return {
    quietAfterDays: quietAfterDaysSchema.parse(row.quietAfterDays),
    audit: toAudit(row),
  };
}

// Only a changed setting has a row: one with no audit is the defaults, never written
export function toBookSettingRow(setting: BookSetting): BookSettingRow {
  if (setting.audit === undefined) {
    throw new Error("The default book settings are not stored");
  }

  return {
    id: bookSettingId,
    quietAfterDays: setting.quietAfterDays,
    ...toAuditRow(setting.audit),
  };
}

import type { BookSettingError } from "@/features/book-settings/application/book-setting-errors";
import { quietAfterDaysLimits } from "@/features/reports/domain/gone-quiet";

export const bookSettingsCopy = {
  quietAfterDays: "Số ngày không đặt",
  quietRange: `Từ ${quietAfterDaysLimits.min} đến ${quietAfterDaysLimits.max} ngày`,
  quietUse: "Dùng cho Báo cáo và thông báo, chung cho cả sổ.",
  quietSaved: "Đã lưu số ngày",
} as const;

export const bookSettingErrorMessages = {
  setting_changed_elsewhere: "Số ngày vừa được đổi ở nơi khác. Hãy xem lại.",
} as const satisfies Record<BookSettingError, string>;

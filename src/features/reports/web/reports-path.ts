import type { PeriodKind } from "@/features/reports/domain/report-period";
import { routes } from "@/shared/web/routes";

// A report lives in its URL, so back, reload and a shared link all keep it. Left out, the period is this month.
export type ReportsQuery = {
  readonly period?: PeriodKind | undefined;
  // A day inside a calendar period, YYYY-MM-DD; left out, today
  readonly on?: string | undefined;
  // A range's days
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly kind?: string | undefined;
  readonly customer?: string | undefined;
  readonly product?: string | undefined;
  // How many days without an order make a customer quiet; left out, the default
  readonly quiet?: string | undefined;
};

// The row of filters. A link that narrows the report from low on the page lands here: the app navigates without
// scrolling when only the query changes, and the page scrolls inside the shell, so the fragment does it.
export const filtersAnchor = "filters";

export function reportsPath(query: ReportsQuery): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (typeof value === "string" && value !== "") {
      params.set(name, value);
    }
  }
  const search = params.toString();

  return search === "" ? routes.reports : `${routes.reports}?${search}`;
}

import type { PeriodKind } from "@/features/reports/domain/report-period";

// What the reports screen shows, worded and formatted, with every link already built

// One choice of a filter, as a row of chips shows it
export type ChoiceView = {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
};

// A filter in force, and the link that drops it
export type FilterView = {
  readonly label: string;
  readonly removeHref: string;
};

export type StatView = {
  readonly label: string;
  readonly value: string;
  readonly tone?: "neutral" | "danger";
};

export type ChangeView = {
  readonly text: string;
  readonly direction: "up" | "down" | "flat";
};

export type ColumnView = {
  readonly key: string;
  // Under the column, on some columns only
  readonly axisLabel: string | undefined;
  // In the readout and the table: "Thứ Hai, 5/10"
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  // Percent of the axis
  readonly share: number;
};

export type ChartView = {
  readonly title: string;
  readonly columns: ReadonlyArray<ColumnView>;
  // The axis from the top line down to zero
  readonly ticks: readonly [string, string, string];
  // The column the readout shows before one is picked: the highest
  readonly peak: number;
  // The table view's column heads: the bucket, its sales, its orders
  readonly tableHeads: readonly [string, string, string];
};

export type BarRowView = {
  readonly key: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly value: string;
  // Percent of the largest row
  readonly share: number;
  // Filters the report to this row; none for customers with no kind, which no filter names
  readonly href: string | undefined;
};

export type BarListView = {
  readonly heading: string;
  readonly rows: ReadonlyArray<BarRowView>;
  readonly footer: string | undefined;
};

export type QuietRowView = {
  readonly id: string;
  readonly name: string;
  readonly area: string | undefined;
  readonly days: string;
  readonly href: string;
};

// The quiet customers, and the field that says after how many days: shown even when nobody is, so the days can change
export type QuietListView = {
  readonly rows: ReadonlyArray<QuietRowView>;
  readonly empty: string | undefined;
  readonly days: string;
  readonly error: string | undefined;
  // The rest of the report's address, sent along with the days
  readonly keep: ReadonlyArray<{ readonly name: string; readonly value: string }>;
};

export type ReportBodyView = {
  // Said instead of the figures when the period has no orders
  readonly empty: string | undefined;
  readonly hero: StatView & { readonly change: ChangeView | undefined };
  readonly stats: ReadonlyArray<StatView>;
  readonly chart: ChartView | undefined;
  readonly byKind: BarListView | undefined;
  readonly products: BarListView | undefined;
  readonly customers: BarListView | undefined;
  readonly quiet: QuietListView | undefined;
};

export type RangeFormView = {
  readonly from: string;
  readonly to: string;
  readonly error: string | undefined;
  // The filters in force, sent along with the days
  readonly keep: ReadonlyArray<{ readonly name: string; readonly value: string }>;
};

export type ReportsView = {
  readonly title: string;
  readonly kind: PeriodKind;
  readonly periods: ReadonlyArray<ChoiceView>;
  readonly previousPath: string;
  // None past today
  readonly nextPath: string | undefined;
  // None when filtered to one customer, or no kinds exist
  readonly kinds: ReadonlyArray<ChoiceView> | undefined;
  readonly filters: ReadonlyArray<FilterView>;
  readonly range: RangeFormView | undefined;
  // None while a range is not right yet
  readonly report: ReportBodyView | undefined;
};

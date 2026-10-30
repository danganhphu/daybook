import { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type { App } from "@/composition/create-app";
import { customerIdSchema } from "@/features/customers/domain/customer";
import { customerKindIdSchema } from "@/features/customers/domain/customer-kind";
import { monthLabel, shortDay } from "@/features/orders/web/day-text";
import { productIdSchema } from "@/features/products/domain/product";
import type { Report } from "@/features/reports/application/read-report";
import {
  orDefaultQuietAfterDays,
  parseQuietAfterDays,
  typedDays,
  type QuietAfterDays,
} from "@/features/reports/domain/gone-quiet";
import {
  nextPeriod,
  periodContaining,
  periodKinds,
  previousPeriod,
  rangeOf,
  type BucketKind,
  type CalendarPeriodKind,
  type PeriodKind,
  type ReportPeriod,
} from "@/features/reports/domain/report-period";
import { calendarDaySchema } from "@/shared/domain/calendar-day";
import type { Money } from "@/shared/domain/money";
import { axisTop, labelStride, shareOf } from "@/shared/web/chart-scale";
import { dayLabel, shortWeekday } from "@/shared/web/day-label";
import { compactMoneyText, moneyText } from "@/shared/web/money-text";
import { customerPath } from "@/shared/web/routes";

import type {
  BarListView,
  BarRowView,
  ChangeView,
  ChartView,
  ChoiceView,
  FilterView,
  RangeFormView,
  ReportBodyView,
  ReportsView,
} from "./report-view";
import {
  comparedWith,
  dayCount,
  emptyPeriod,
  noneQuiet,
  orderCount,
  reportsCopy,
  restOf,
  timesOver,
} from "./reports-copy";
import { filtersAnchor, reportsPath, type ReportsQuery } from "./reports-path";

// The reports screen's work, minus the framework: read what the URL asks, call the app, answer with a view. The page
// wraps it; tests call it directly.

const periodKindSchema = z.enum(periodKinds);

type Asked = {
  readonly kind: PeriodKind;
  // None while a range is not right yet
  readonly period: ReportPeriod | undefined;
  readonly range: Omit<RangeFormView, "keep"> | undefined;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function askedPeriod(
  params: {
    readonly period?: unknown;
    readonly on?: unknown;
    readonly from?: unknown;
    readonly to?: unknown;
  },
  today: Temporal.PlainDate,
): Asked {
  const kind = periodKindSchema.safeParse(params.period).data ?? "month";
  if (kind !== "range") {
    const on = calendarDaySchema.safeParse(params.on);
    const day = on.success && Temporal.PlainDate.compare(on.data, today) <= 0 ? on.data : today;
    return { kind, period: periodContaining(kind, day), range: undefined };
  }

  const typed = { from: text(params.from), to: text(params.to) };
  const from = calendarDaySchema.safeParse(params.from);
  const to = calendarDaySchema.safeParse(params.to);
  if (!from.success || !to.success) {
    return { kind, period: undefined, range: { ...typed, error: reportsCopy.rangeMissing } };
  }
  // Days typed the wrong way round are swapped rather than refused
  const [first, last] =
    Temporal.PlainDate.compare(from.data, to.data) <= 0
      ? [from.data, to.data]
      : [to.data, from.data];
  const range = rangeOf(first, last);

  return range.ok
    ? {
        kind,
        period: range.value,
        range: { from: first.toString(), to: last.toString(), error: undefined },
      }
    : { kind, period: undefined, range: { ...typed, error: reportsCopy.rangeErrors[range.error] } };
}

function contains(period: ReportPeriod, day: Temporal.PlainDate): boolean {
  return (
    Temporal.PlainDate.compare(period.from, day) <= 0 &&
    Temporal.PlainDate.compare(day, period.to) <= 0
  );
}

type Filters = Pick<ReportsQuery, "kind" | "customer" | "product">;

type QuietAsked = {
  readonly days: QuietAfterDays;
  // What the field shows: the days, or what was typed when it was refused
  readonly typed: string;
  readonly error: string | undefined;
  // In the address only when not the default
  readonly query: string | undefined;
};

function askedQuiet(value: unknown): QuietAsked {
  const fallback = orDefaultQuietAfterDays();
  if (typeof value !== "string" || value === "") {
    return { days: fallback, typed: String(fallback), error: undefined, query: undefined };
  }
  const parsed = parseQuietAfterDays(typedDays(value));
  if (!parsed.ok) {
    return { days: fallback, typed: value, error: parsed.error, query: undefined };
  }

  return {
    days: parsed.value,
    typed: String(parsed.value),
    error: undefined,
    query: parsed.value === fallback ? undefined : String(parsed.value),
  };
}

// A query's parts as a form's hidden fields
function fieldsOf(
  query: ReportsQuery,
): ReadonlyArray<{ readonly name: string; readonly value: string }> {
  return Object.entries(query).flatMap(([name, value]) =>
    typeof value === "string" && value !== "" ? [{ name, value }] : [],
  );
}

// The query for a period: a calendar one by a day inside it, left out when that is today's
function periodQuery(period: ReportPeriod, today: Temporal.PlainDate): ReportsQuery {
  if (period.kind === "range") {
    return { period: "range", from: period.from.toString(), to: period.to.toString() };
  }

  return {
    period: period.kind === "month" ? undefined : period.kind,
    on: contains(period, today) ? undefined : period.from.toString(),
  };
}

function calendarPeriod(kind: CalendarPeriodKind, near: ReportPeriod, today: Temporal.PlainDate) {
  return periodContaining(kind, contains(near, today) ? today : near.from);
}

function titleOf(period: ReportPeriod, today: Temporal.PlainDate): string {
  const { from, to } = period;
  switch (period.kind) {
    case "week":
      return `Tuần ${shortDay(from.toString())} - ${shortDay(to.toString())}${to.year === today.year ? "" : `/${to.year}`}`;
    case "month":
      return monthLabel(from.toPlainYearMonth().toString());
    case "quarter":
      return `Quý ${Math.ceil(from.month / 3)}/${from.year}`;
    case "year":
      return `Năm ${from.year}`;
    case "range":
      return from.year === to.year
        ? `${shortDay(from.toString())} - ${shortDay(to.toString())}/${to.year}`
        : `${shortDay(from.toString())}/${from.year} - ${shortDay(to.toString())}/${to.year}`;
    default:
      return period.kind satisfies never;
  }
}

function bucketLabel(
  start: Temporal.PlainDate,
  bucket: BucketKind,
  today: Temporal.PlainDate,
): string {
  switch (bucket) {
    case "day":
      return dayLabel(start, today);
    case "week":
      return `Tuần ${shortDay(start.toString())} - ${shortDay(start.add({ days: 6 }).toString())}`;
    case "month":
      return monthLabel(start.toPlainYearMonth().toString());
    default:
      return bucket satisfies never;
  }
}

function axisLabel(start: Temporal.PlainDate, bucket: BucketKind, kind: PeriodKind): string {
  if (bucket === "month") {
    return `T${start.month}`;
  }
  if (bucket === "week" || kind === "range") {
    return shortDay(start.toString());
  }

  return kind === "week" ? shortWeekday(start) : String(start.day);
}

// From ten times the previous figure up, how many times says more than a percentage in the thousands
const timesFrom = 10;

function changeOf(current: Money, previous: Money, kind: PeriodKind): ChangeView | undefined {
  if (previous === 0) {
    return undefined;
  }
  const name = reportsCopy.previousOfKind[kind];
  if (current >= previous * timesFrom) {
    return { text: timesOver(Math.round(current / previous), name), direction: "up" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);

  return {
    text: comparedWith(percent, name),
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
  };
}

function chartOf(report: Report, kind: PeriodKind, today: Temporal.PlainDate): ChartView {
  const points = report.overTime;
  const top = axisTop(Math.max(...points.map((point) => point.sales)));
  const stride = labelStride(points.length);
  const peak = points.reduce(
    (best, point, index) => (point.sales > (points[best]?.sales ?? 0) ? index : best),
    0,
  );

  return {
    title: reportsCopy.overTime[report.bucket],
    columns: points.map((point, index) => ({
      key: point.start.toString(),
      axisLabel: index % stride === 0 ? axisLabel(point.start, report.bucket, kind) : undefined,
      label: bucketLabel(point.start, report.bucket, today),
      value: moneyText(point.sales),
      detail: orderCount(point.orders),
      share: shareOf(point.sales, top),
    })),
    ticks: [compactMoneyText(top), compactMoneyText(top / 2), compactMoneyText(0)],
    peak,
    tableHeads: [reportsCopy.buckets[report.bucket], reportsCopy.sales, reportsCopy.orders],
  };
}

// Rows as bars against the largest one
function bars<Row extends { readonly sales: Money }>(
  heading: string,
  rows: ReadonlyArray<Row>,
  row: (each: Row, share: number) => BarRowView,
  footer?: string,
): BarListView {
  const largest = Math.max(0, ...rows.map((each) => each.sales));

  return {
    heading,
    rows: rows.map((each) => row(each, shareOf(each.sales, largest))),
    footer,
  };
}

function bodyOf(
  report: Report,
  kind: PeriodKind,
  title: string,
  today: Temporal.PlainDate,
  // A ranking row's link, narrowing the report to that row
  narrowTo: (filters: Filters) => string,
  quietAsked: QuietAsked,
  // The rest of the address, kept by the days' field
  quietKeep: ReadonlyArray<{ readonly name: string; readonly value: string }>,
): ReportBodyView {
  const empty = report.sales.orders === 0;
  const { byKind, products, customers, quiet } = report;
  const stats =
    report.received === undefined || report.owed === undefined
      ? [
          { label: reportsCopy.units, value: String(report.sales.units) },
          { label: reportsCopy.orders, value: String(report.sales.orders) },
        ]
      : [
          { label: reportsCopy.received, value: moneyText(report.received) },
          {
            label: reportsCopy.owed,
            value: moneyText(report.owed),
            tone: report.owed > 0 ? ("danger" as const) : ("neutral" as const),
          },
          { label: reportsCopy.orders, value: String(report.sales.orders) },
        ];

  return {
    empty: empty ? emptyPeriod(title) : undefined,
    hero: {
      label: reportsCopy.sales,
      value: moneyText(report.sales.sales),
      change: changeOf(report.sales.sales, report.previousSales, kind),
    },
    stats,
    chart: empty ? undefined : chartOf(report, kind, today),
    // A breakdown into one part says nothing
    byKind:
      byKind === undefined || byKind.length < 2
        ? undefined
        : bars(reportsCopy.byKind, byKind, (each, share) => ({
            key: each.kindId ?? "",
            title: each.kindName ?? reportsCopy.noKind,
            detail: undefined,
            value: moneyText(each.sales),
            share,
            href: each.kindId === undefined ? undefined : narrowTo({ kind: each.kindId }),
          })),
    products:
      products === undefined || products.rows.length === 0
        ? undefined
        : bars(
            reportsCopy.products,
            products.rows,
            (each, share) => ({
              key: each.productId,
              title: each.name,
              detail: `${reportsCopy.units} ${each.units}`,
              value: moneyText(each.sales),
              share,
              href: narrowTo({ product: each.productId }),
            }),
            products.rest > 0 ? restOf("products", moneyText(products.rest)) : undefined,
          ),
    customers:
      customers === undefined || customers.rows.length === 0
        ? undefined
        : bars(
            reportsCopy.customers,
            customers.rows,
            (each, share) => ({
              key: each.customerId,
              title: each.name,
              detail: each.area,
              value: moneyText(each.sales),
              share,
              href: narrowTo({ customer: each.customerId }),
            }),
            customers.rest > 0 ? restOf("customers", moneyText(customers.rest)) : undefined,
          ),
    quiet:
      quiet === undefined
        ? undefined
        : {
            rows: quiet.customers.map((each) => ({
              id: each.customerId,
              name: each.name,
              area: each.area,
              days: dayCount(each.lastOrderedOn.until(today, { largestUnit: "days" }).days),
              href: customerPath(each.customerId),
            })),
            empty: quiet.customers.length === 0 ? noneQuiet(quiet.afterDays) : undefined,
            days: quietAsked.typed,
            error: quietAsked.error,
            keep: quietKeep,
          },
  };
}

export async function reportsScreen(
  app: App,
  params: Readonly<Record<string, unknown>>,
): Promise<ReportsView> {
  const today = app.today();
  const asked = askedPeriod(params, today);
  const kindId = customerKindIdSchema.safeParse(params["kind"]).data;
  const customerId = customerIdSchema.safeParse(params["customer"]).data;
  const productId = productIdSchema.safeParse(params["product"]).data;
  const quietAsked = askedQuiet(params["quiet"]);

  // A filter naming something that is not in the book is dropped
  const [kinds, customer, products] = await Promise.all([
    app.listCustomerKinds(),
    customerId === undefined ? undefined : app.getCustomer(customerId),
    productId === undefined ? [] : app.getProducts([productId]),
  ]);
  const kind = kinds.find((each) => each.id === kindId);
  const product = products[0];
  const filters: Filters = { kind: kind?.id, customer: customer?.id, product: product?.id };

  const shown = asked.period ?? periodContaining("month", today);
  const here = periodQuery(shown, today);
  // The days carry over from one period or filter to another, as the filters do
  const quiet = quietAsked.query;
  const pathWith = (changed: Filters) => reportsPath({ ...here, ...filters, quiet, ...changed });
  const pathFor = (period: ReportPeriod) =>
    reportsPath({ ...periodQuery(period, today), ...filters, quiet });

  const removable: FilterView[] = [];
  const activeKinds = kinds.filter((each) => each.status === "active");
  // An archived kind has no chip, so it shows as a filter that can be dropped
  if (kind !== undefined && kind.status !== "active") {
    removable.push({ label: kind.name, removeHref: pathWith({ kind: undefined }) });
  }
  if (customer !== undefined) {
    removable.push({ label: customer.name, removeHref: pathWith({ customer: undefined }) });
  }
  if (product !== undefined) {
    removable.push({ label: product.name, removeHref: pathWith({ product: undefined }) });
  }

  const periods: ReadonlyArray<ChoiceView> = periodKinds.map((each) => ({
    label: reportsCopy.periodKinds[each],
    href: pathFor(
      each === "range"
        ? { kind: "range", from: shown.from, to: shown.to }
        : calendarPeriod(each, shown, today),
    ),
    current: each === asked.kind,
  }));
  const kindChoices: ReadonlyArray<ChoiceView> | undefined =
    customer !== undefined || activeKinds.length === 0
      ? undefined
      : [
          {
            label: reportsCopy.allKinds,
            href: pathWith({ kind: undefined }),
            current: kind === undefined,
          },
          ...activeKinds.map((each) => ({
            label: each.name,
            href: pathWith({ kind: each.id }),
            current: each.id === kind?.id,
          })),
        ];
  const next = nextPeriod(shown);
  const title =
    asked.period === undefined ? reportsCopy.periodKinds.range : titleOf(asked.period, today);

  const report =
    asked.period === undefined
      ? undefined
      : await app.readReport({
          period: asked.period,
          kindId: kind?.id,
          customerId: customer?.id,
          productId: product?.id,
          quietAfterDays: quietAsked.days,
        });

  return {
    title,
    kind: asked.kind,
    periods,
    previousPath: pathFor(previousPeriod(shown)),
    nextPath: Temporal.PlainDate.compare(next.from, today) > 0 ? undefined : pathFor(next),
    kinds: kindChoices,
    filters: removable,
    range:
      asked.range === undefined
        ? undefined
        : { ...asked.range, keep: fieldsOf({ ...filters, quiet }) },
    report:
      report === undefined
        ? undefined
        : bodyOf(
            report,
            asked.kind,
            title,
            today,
            (changed) => `${pathWith(changed)}#${filtersAnchor}`,
            quietAsked,
            fieldsOf({ ...here, ...filters }),
          ),
  };
}

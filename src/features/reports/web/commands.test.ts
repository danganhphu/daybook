import { describe, expect, it } from "vitest";

import { quietAfterDaysSchema } from "@/features/book-settings/domain/book-setting";
import { testApp, testClock, theAuthor } from "@/testing/support/app";
import { aCustomer, aKind, anOrder, line } from "@/testing/support/orders";
import { expectOk } from "@/testing/support/result";

import { reportsScreen } from "./commands";

// 10:00 in Vietnam on Friday 23 October 2026
function anApp() {
  return testApp(testClock("2026-10-23T03:00:00Z").clock);
}

// The parameters a link on the screen carries
function paramsOf(href: string | undefined): Record<string, string> {
  return Object.fromEntries(new URL(href ?? "/", "https://daybook.example").searchParams);
}

// October: 850.000đ over two orders; September: 500.000đ, the last order of a customer gone quiet
async function aBook() {
  const app = anApp();
  const clinic = await aKind(app, "Nha khoa");
  const sunflower = await aCustomer(app, "Hướng Dương", { kindId: clinic.id, area: "Quận 3" });
  const morning = await aCustomer(app, "Sao Mai");
  const lagoon = await aCustomer(app, "Ánh Dương");
  await anOrder(app, sunflower, [line("Thuốc tê", 2, 400_000)], "2026-10-05");
  await anOrder(app, morning, [line("Bông gòn", 10, 5_000)], "2026-10-20");
  await anOrder(app, sunflower, [line("Thuốc tê", 1, 400_000)], "2026-09-10");
  await anOrder(app, lagoon, [line("Găng tay", 1, 100_000)], "2026-09-25");

  return { app, clinic, sunflower, lagoon };
}

describe("the reports screen", () => {
  it("given nothing asked, when shown, then it is this month, compared with the last, with no way past it", async () => {
    const { app } = await aBook();

    const view = await reportsScreen(app, {});

    expect(view.title).toBe("Tháng 10/2026");
    expect(view.nextPath).toBeUndefined();
    expect(view.previousPath).toBe("/reports?on=2026-09-01");
    expect(view.report?.hero).toEqual({
      label: "Doanh số",
      value: "850.000đ",
      change: { text: "+70% so với tháng trước", direction: "up" },
    });
    expect(view.report?.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ["Thu về", "0đ"],
      ["Khách còn nợ", "1.350.000đ"],
      ["Số đơn", "2"],
    ]);
    expect(view.periods.map((each) => [each.label, each.href, each.current])).toEqual([
      ["Tuần", "/reports?period=week", false],
      ["Tháng", "/reports", true],
      ["Quý", "/reports?period=quarter", false],
      ["Năm", "/reports?period=year", false],
      ["Khoảng ngày", "/reports?period=range&from=2026-10-01&to=2026-10-31", false],
    ]);
  });

  it("given a month, when charted, then every day is a column on a round axis and the highest is picked first", async () => {
    const { app } = await aBook();

    const chart = (await reportsScreen(app, {})).report?.chart;

    expect(chart?.title).toBe("Doanh số theo ngày");
    expect(chart?.columns).toHaveLength(31);
    expect(chart?.ticks).toEqual(["1tr", "500k", "0"]);
    expect(chart?.peak).toBe(4);
    expect(chart?.columns[4]).toEqual({
      key: "2026-10-05",
      axisLabel: undefined,
      label: "Thứ Hai, 5/10",
      value: "800.000đ",
      detail: "1 đơn",
      share: 80,
    });
    expect(chart?.columns.flatMap((column) => column.axisLabel ?? [])).toEqual([
      "1",
      "6",
      "11",
      "16",
      "21",
      "26",
      "31",
    ]);
  });

  it("given a month gone and a day ahead of today, when asked, then the gone one shows with a way forward and the day ahead falls back to today", async () => {
    const { app } = await aBook();

    const september = await reportsScreen(app, { on: "2026-09-15" });
    const ahead = await reportsScreen(app, { on: "2027-01-05" });

    expect([september.title, september.nextPath]).toEqual(["Tháng 9/2026", "/reports"]);
    expect(ahead.title).toBe("Tháng 10/2026");
  });

  it("given a week, a quarter and a year, when asked, then each is titled and charted in its own columns", async () => {
    const { app } = await aBook();

    const week = await reportsScreen(app, { period: "week" });
    const quarter = await reportsScreen(app, { period: "quarter" });
    const year = await reportsScreen(app, { period: "year" });

    expect(week.title).toBe("Tuần 19/10 - 25/10");
    expect(week.report?.chart?.columns.map((column) => column.axisLabel)).toEqual([
      "T2",
      "T3",
      "T4",
      "T5",
      "T6",
      "T7",
      "CN",
    ]);
    expect([quarter.title, quarter.report?.chart?.title]).toEqual([
      "Quý 4/2026",
      "Doanh số theo tuần",
    ]);
    expect(year.title).toBe("Năm 2026");
    expect(year.report?.chart?.columns[0]?.axisLabel).toBe("T1");
  });

  it("given a range typed the wrong way round, when asked, then its days are swapped", async () => {
    const { app } = await aBook();

    const view = await reportsScreen(app, {
      period: "range",
      from: "2026-10-20",
      to: "2026-10-05",
    });

    expect(view.title).toBe("5/10 - 20/10/2026");
    expect(view.range).toEqual({
      from: "2026-10-05",
      to: "2026-10-20",
      error: undefined,
      keep: [],
    });
    expect(view.report?.hero.value).toBe("850.000đ");
  });

  it("given a range missing a day or longer than two years, when asked, then the form says why and nothing is read", async () => {
    const { app } = await aBook();

    const missing = await reportsScreen(app, { period: "range", from: "2026-10-05" });
    const long = await reportsScreen(app, {
      period: "range",
      from: "2023-01-01",
      to: "2026-01-01",
    });

    expect([missing.range?.error, missing.report]).toEqual([
      "Chọn ngày bắt đầu và ngày kết thúc",
      undefined,
    ]);
    expect(long.range?.error).toBe("Khoảng ngày dài nhất 2 năm");
  });

  it("given a product row, when followed, then the report is that product's, its units told instead of money in and owed", async () => {
    const { app } = await aBook();
    const row = (await reportsScreen(app, {})).report?.products?.rows[0];

    const view = await reportsScreen(app, paramsOf(row?.href));

    expect(row?.title).toBe("Thuốc tê");
    expect(view.filters.map((filter) => filter.label)).toEqual(["Thuốc tê"]);
    expect(view.filters[0]?.removeHref).toBe("/reports");
    expect(view.report?.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ["Số lượng", "2"],
      ["Số đơn", "1"],
    ]);
    expect(view.report?.products).toBeUndefined();
  });

  it("given a customer row, when followed, then the kind chips give way to the customer's filter", async () => {
    const { app } = await aBook();
    const row = (await reportsScreen(app, {})).report?.customers?.rows[0];

    const view = await reportsScreen(app, paramsOf(row?.href));

    expect([row?.title, row?.detail]).toEqual(["Hướng Dương", "Quận 3"]);
    expect(view.kinds).toBeUndefined();
    expect(view.filters.map((filter) => filter.label)).toEqual(["Hướng Dương"]);
    expect(view.report?.hero.value).toBe("800.000đ");
  });

  it("given kinds, when split, then a customer with no kind has a row that filters nothing", async () => {
    const { app, clinic } = await aBook();

    const rows = (await reportsScreen(app, {})).report?.byKind?.rows;

    expect(rows?.map((row) => [row.title, row.value, row.share])).toEqual([
      ["Nha khoa", "800.000đ", 100],
      ["Chưa có loại", "50.000đ", 6],
    ]);
    expect(paramsOf(rows?.[0]?.href)).toEqual({ kind: clinic.id });
    expect(rows?.[1]?.href).toBeUndefined();
  });

  it("given a product that is not in the book, when asked for, then the filter is dropped", async () => {
    const { app } = await aBook();

    const view = await reportsScreen(app, { product: "019a0000-0000-7000-8000-0000000000d9" });

    expect(view.filters).toEqual([]);
    expect(view.report?.hero.value).toBe("850.000đ");
  });

  it("given a month ten times the last or more, when compared, then it says how many times rather than a percentage", async () => {
    const app = anApp();
    const customer = await aCustomer(app, "Hướng Dương");
    await anOrder(app, customer, [line("Bông gòn", 2, 5_000)], "2026-09-10");
    await anOrder(app, customer, [line("Thuốc tê", 1, 400_000)], "2026-10-05");

    const change = (await reportsScreen(app, {})).report?.hero.change;

    expect(change).toEqual({ text: "Gấp 40 lần tháng trước", direction: "up" });
  });

  it("given a ranking row, when followed, then it lands on the row of filters, since only the query changes", async () => {
    const { app } = await aBook();

    const row = (await reportsScreen(app, {})).report?.products?.rows[0];

    expect(new URL(row?.href ?? "", "https://daybook.example").hash).toBe("#filters");
  });

  it("given a month with no orders, when shown, then it says so and draws no chart", async () => {
    const { app } = await aBook();

    const report = (await reportsScreen(app, { on: "2026-08-10" })).report;

    expect(report?.empty).toBe("Tháng 8/2026 chưa có đơn nào");
    expect(report?.chart).toBeUndefined();
    expect(report?.hero.change).toBeUndefined();
  });

  it("given a customer whose last order is four weeks old, when shown, then they are listed as quiet with the days since", async () => {
    const { app, lagoon } = await aBook();

    const quiet = (await reportsScreen(app, {})).report?.quiet;

    expect(quiet).toEqual({
      rows: [
        {
          id: lagoon.id,
          name: "Ánh Dương",
          area: undefined,
          days: "28 ngày",
          href: `/customers/${lagoon.id}`,
        },
      ],
      footer: "Không có đơn nào trong 21 ngày qua",
    });
  });

  it("given the book counts 30 days, when shown, then a customer four weeks quiet is not listed", async () => {
    const { app } = await aBook();
    expectOk(
      await app.changeQuietAfterDays({
        by: await theAuthor(),
        days: quietAfterDaysSchema.parse(30),
        shown: undefined,
      }),
    );

    expect((await reportsScreen(app, {})).report?.quiet).toBeUndefined();
  });
});

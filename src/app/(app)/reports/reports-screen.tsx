import Form from "next/form";

import { AccountMenu } from "@/app/(app)/_shell/account-menu";
import type { BarListView, ReportsView } from "@/features/reports/web/report-view";
import { removeFilter, reportsCopy } from "@/features/reports/web/reports-copy";
import { filtersAnchor } from "@/features/reports/web/reports-path";
import { Button } from "@/shared/ui/button/button";
import { IconButton } from "@/shared/ui/button/icon-button";
import { IconLink } from "@/shared/ui/button/icon-link";
import { ColumnChart } from "@/shared/ui/chart/column-chart";
import { ChipLinks } from "@/shared/ui/chip-links/chip-links";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { FilterChips } from "@/shared/ui/filter-chips/filter-chips";
import { iconTones } from "@/shared/ui/icon/icon-tone";
import { ChevronLeftIcon, ChevronRightIcon, PersonIcon } from "@/shared/ui/icon/icons";
import { List } from "@/shared/ui/list/list";
import { ListBar } from "@/shared/ui/list/list-bar";
import { ListLink } from "@/shared/ui/list/list-link";
import { Screen } from "@/shared/ui/screen/screen";
import { Stats } from "@/shared/ui/stats/stats";
import { TextField } from "@/shared/ui/text-field/text-field";
import { routes } from "@/shared/web/routes";

import styles from "./reports.module.scss";

const accountMenu = <AccountMenu />;

function Ranking({ list }: { readonly list: BarListView | undefined }) {
  if (list === undefined) {
    return null;
  }

  return (
    <List heading={list.heading} footer={list.footer}>
      {list.rows.map((row) => (
        <ListBar
          key={row.key}
          title={row.title}
          detail={row.detail}
          value={row.value}
          share={row.share}
          href={row.href}
        />
      ))}
    </List>
  );
}

// A period's figures: what was sold, what came in, what is owed, over time and by kind, product and customer, and
// who has gone quiet. The period and every filter are links, so they live in the URL.
export function ReportsScreen({ view }: { readonly view: ReportsView }) {
  const { report, range } = view;

  return (
    <Screen title={reportsCopy.title} actions={accountMenu}>
      <div className={styles.filters} id={filtersAnchor}>
        <ChipLinks label={reportsCopy.periodChoice} chips={view.periods} />
        {range === undefined ? null : (
          <Form action={routes.reports} className={styles.range}>
            <input type="hidden" name="period" value="range" />
            {range.keep.map((each) => (
              <input key={each.name} type="hidden" name={each.name} value={each.value} />
            ))}
            <TextField label={reportsCopy.from} type="date" name="from" defaultValue={range.from} />
            <TextField label={reportsCopy.to} type="date" name="to" defaultValue={range.to} />
            <Button type="submit">{reportsCopy.show}</Button>
            {range.error === undefined ? null : <p className={styles.error}>{range.error}</p>}
          </Form>
        )}
        {view.kinds === undefined ? null : (
          <ChipLinks label={reportsCopy.allKinds} chips={view.kinds} />
        )}
        <FilterChips
          label={reportsCopy.filtering}
          chips={view.filters}
          removeLabel={removeFilter}
        />
      </div>

      {report === undefined ? null : (
        <>
          <nav className={styles.periods} aria-label={view.title}>
            <IconLink
              icon={ChevronLeftIcon}
              label={reportsCopy.previous}
              href={view.previousPath}
            />
            <h2 className={styles.title}>{view.title}</h2>
            {view.nextPath === undefined ? (
              <IconButton icon={ChevronRightIcon} label={reportsCopy.noNext} disabled />
            ) : (
              <IconLink icon={ChevronRightIcon} label={reportsCopy.next} href={view.nextPath} />
            )}
          </nav>

          <Stats label={view.title} hero={report.hero} items={report.stats} />
          {report.empty === undefined ? null : <EmptyState title={report.empty} />}

          {report.chart === undefined ? null : (
            <ColumnChart
              heading={report.chart.title}
              columns={report.chart.columns}
              ticks={report.chart.ticks}
              peak={report.chart.peak}
              peakLabel={reportsCopy.peak}
              tableLabel={reportsCopy.table}
              tableHeads={report.chart.tableHeads}
            />
          )}
          <Ranking list={report.byKind} />
          <Ranking list={report.products} />
          <Ranking list={report.customers} />

          {report.quiet === undefined ? null : (
            <List heading={reportsCopy.quiet} footer={reportsCopy.quietFooter}>
              {report.quiet.map((row) => (
                <ListLink
                  key={row.id}
                  href={row.href}
                  title={row.name}
                  detail={row.area}
                  value={row.days}
                  icon={PersonIcon}
                  iconTone={iconTones.customer}
                />
              ))}
            </List>
          )}
        </>
      )}
    </Screen>
  );
}

import type { Metadata } from "next";
import { Temporal } from "temporal-polyfill/implementation";

import { settingsCopy } from "@/app/settings/settings-copy";
import { accountView, openedFrom, type SettingsPageProps } from "@/app/settings/settings-data";
import { daybook } from "@/composition/daybook";
import { activityLimits } from "@/features/access/application/account-overview";
import { accessCopy, activityWindow, noActivity } from "@/features/access/web/access-copy";
import type { ActivityRow } from "@/features/access/web/account-view";
import { requireSession } from "@/features/access/web/session-gate";
import { ButtonLink } from "@/shared/ui/button/button-link";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { List } from "@/shared/ui/list/list";
import { ListRow } from "@/shared/ui/list/list-row";
import { Screen } from "@/shared/ui/screen/screen";
import { dayHeading } from "@/shared/web/day-label";
import { routes, settingsPath } from "@/shared/web/routes";

export const metadata: Metadata = { title: settingsCopy.activity };

export const dynamic = "force-dynamic";

// How many rows the address asks for: a page, or a few more pages after Xem thêm
function shownAsked(value: unknown): number {
  const pages = typeof value === "string" && /^\d{1,3}$/.test(value) ? Number(value) : 1;

  return Math.min(Math.max(pages, 1) * activityLimits.page, activityLimits.most);
}

function byDay(rows: ReadonlyArray<ActivityRow>): ReadonlyArray<readonly [string, ActivityRow[]]> {
  const days = new Map<string, ActivityRow[]>();
  for (const row of rows) {
    days.set(row.day, [...(days.get(row.day) ?? []), row]);
  }

  return [...days];
}

// The account's sign-in log, the last 30 days, by day, a page at a time
export default async function ActivitySettingsPage(props: SettingsPageProps) {
  const app = daybook();
  const session = await requireSession(app);
  const pages = (await props.searchParams)["pages"];
  const shown = shownAsked(pages);
  const [view, from] = await Promise.all([accountView(app, session, shown), openedFrom(props)]);
  const today = app.today();
  const morePath = `${settingsPath(from, routes.settingsActivity)}&pages=${shown / activityLimits.page + 1}`;

  return (
    <Screen title={settingsCopy.activity} back={settingsPath(from)}>
      {view.activity.length === 0 ? (
        <EmptyState title={noActivity(activityLimits.days)} />
      ) : (
        byDay(view.activity).map(([day, rows], index, all) => (
          <List
            key={day}
            heading={dayHeading(Temporal.PlainDate.from(day), today).title}
            footer={
              index === all.length - 1 && !view.moreActivity
                ? activityWindow(activityLimits.days)
                : undefined
            }
          >
            {rows.map((event) => (
              <ListRow key={event.id} title={event.title} detail={event.detail} />
            ))}
          </List>
        ))
      )}
      {view.moreActivity ? (
        <ButtonLink href={morePath} variant="secondary">
          {accessCopy.moreActivity}
        </ButtonLink>
      ) : null}
    </Screen>
  );
}

import type { InboxView } from "@/features/notifications/web/inbox-view";
import { notificationsCopy } from "@/features/notifications/web/notifications-copy";
import { EmptyState } from "@/shared/ui/empty-state/empty-state";
import { Screen } from "@/shared/ui/screen/screen";

import { InboxList } from "./inbox-list";

// What the app has told this person, newest first, each opening where its notification opens
export function NotificationsScreen({
  view,
  back,
}: {
  readonly view: InboxView;
  readonly back: string;
}) {
  return (
    <Screen title={notificationsCopy.title} back={back}>
      {view.rows.length === 0 ? (
        <EmptyState title={notificationsCopy.inboxEmpty} description={view.footer} />
      ) : (
        <InboxList view={view} />
      )}
    </Screen>
  );
}

import { AccountMenu } from "./account-menu";
import { NotificationsBell } from "./notifications-bell";

// The end of every tab's header: the notifications, then the account
export function TabActions({ unread }: { readonly unread: number }) {
  return (
    <>
      <NotificationsBell unread={unread} />
      <AccountMenu />
    </>
  );
}

import { routes } from "@/shared/web/routes";

// The reminders page's query: the finished view, and where its page starts
export const remindersQuery = { view: "view", doneView: "done", after: "after" } as const;

export function doneRemindersPath(after?: string): string {
  const query = new URLSearchParams({ [remindersQuery.view]: remindersQuery.doneView });
  if (after !== undefined) {
    query.set(remindersQuery.after, after);
  }

  return `${routes.reminders}?${query.toString()}`;
}

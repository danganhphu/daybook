// What the browser gets for reminders: plain values across the server-client boundary. Days are YYYY-MM-DD.

export type ReminderView = {
  readonly id: string;
  readonly version: number;
  readonly text: string;
  readonly dueOn: string;
  // "Hôm nay", "Ngày mai", "Thứ Năm, 29/10", or how late
  readonly due: string;
  readonly overdue: boolean;
  readonly customer: { readonly id: string; readonly name: string } | undefined;
};

export type ReminderGroup = {
  // "Quá hạn", "Hôm nay", "Ngày mai", or the date
  readonly label: string;
  readonly reminders: ReadonlyArray<ReminderView>;
};

// What Hôm nay shows above the notes: the most overdue first, and how many more wait
export type DueView = {
  readonly first: ReminderView;
  readonly more: number;
};

// Settings > Thông báo as the screen shows it: words ready to render, ids for the actions

export type NotifiedDeviceRow = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly current: boolean;
};

export type NotificationTimesView = {
  // HH:MM, or undefined for off
  readonly morningAt: string | undefined;
  readonly weeklyAt: string | undefined;
  // Undefined while the times are the defaults, never saved
  readonly version: number | undefined;
};

export type NotificationsView = NotificationTimesView & {
  // Whether this deploy can send at all; the browser decides the rest
  readonly available: boolean;
  // What a browser subscribes with
  readonly publicKey: string | undefined;
  // This browser's subscription, as the server has it under this sign-in
  readonly thisDevice: string | undefined;
  readonly devices: ReadonlyArray<NotifiedDeviceRow>;
};

// What a browser hands over from PushSubscription.toJSON()
export type BrowserSubscription = {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
};

export type BookSettingView = {
  readonly quietAfterDays: number;
  // Sent back with a change; undefined while the defaults hold
  readonly version: number | undefined;
};

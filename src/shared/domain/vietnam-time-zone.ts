// The user's day is a Vietnamese calendar day. Vietnam has kept UTC+07:00 since 1975, with no daylight saving, so the
// zone is that fixed offset and the Worker loads no time zone data; vietnam-time-zone.test.ts holds it to
// Asia/Ho_Chi_Minh. Kept apart from the Temporal helpers so browser code can use it without bundling the polyfill.
export const vietnamTimeZone = "+07:00";

export const vietnamOffsetMilliseconds = 7 * 60 * 60 * 1000;

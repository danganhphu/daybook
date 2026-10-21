// The user's day is a Vietnamese calendar day. Going through the zone, not a fixed +07:00, keeps that from being an assumption.
// Kept apart from the Temporal helpers so browser code can use it without bundling the polyfill.
export const vietnamTimeZone = "Asia/Ho_Chi_Minh";

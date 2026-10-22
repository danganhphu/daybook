import {
  deviceLabelMaxLength,
  deviceLabelSchema,
  type DeviceLabel,
} from "@/features/access/domain/session";

// What the user agent says, as next/server's userAgent() reads it
export type UserAgentNames = {
  readonly browser: string | undefined;
  readonly os: string | undefined;
};

// Only the names ua-parser-js (1.0, behind userAgent()) gives that read badly; every other name passes through as
// it comes: Chrome, Edge, Firefox, Opera, Coc Coc, Android, iOS, Windows...
const browserNames: Readonly<Record<string, string>> = {
  "Mobile Safari": "Safari",
  "Chrome Headless": "Chrome",
  // A page opened inside another app on Android: Zalo, Facebook, Messenger
  "Chrome WebView": "Trình duyệt trong app",
  "Samsung Browser": "Samsung Internet",
  // The Google app on an iPhone
  GSA: "App Google",
};

const osNames: Readonly<Record<string, string>> = {
  "Mac OS": "macOS",
  "Chromium OS": "ChromeOS",
};

// How the device list names a device: "Chrome trên Android", "Safari trên iOS"
export function deviceLabelFor(agent: UserAgentNames): DeviceLabel {
  if (agent.browser === undefined && agent.os === undefined) {
    return deviceLabelSchema.parse("Thiết bị không rõ");
  }

  const browser =
    agent.browser === undefined ? "Trình duyệt" : (browserNames[agent.browser] ?? agent.browser);
  const label =
    agent.os === undefined ? browser : `${browser} trên ${osNames[agent.os] ?? agent.os}`;

  return deviceLabelSchema.parse(label.slice(0, deviceLabelMaxLength));
}

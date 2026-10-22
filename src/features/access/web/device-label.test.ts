// next/server is a vinext shim the test runner does not load; this is the module behind it
import { userAgentFromString } from "vinext/shims/user-agent";
import { describe, expect, it } from "vitest";

import { deviceLabelFor } from "./device-label";

// Real user agent strings, read by the same parser the app uses
const agents = {
  chromeOnAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  safariOnIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  safariOnMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  edgeOnWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  webViewOnAndroid:
    "Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36",
  samsungOnAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  cocCocOnWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/134.0.0 Chrome/128.0.0.0 Safari/537.36",
};

function labelOf(agent: string) {
  const parsed = userAgentFromString(agent);

  return deviceLabelFor({ browser: parsed.browser.name, os: parsed.os.name });
}

describe("deviceLabelFor", () => {
  it.each([
    [agents.chromeOnAndroid, "Chrome trên Android"],
    [agents.safariOnIphone, "Safari trên iOS"],
    [agents.safariOnMac, "Safari trên macOS"],
    [agents.edgeOnWindows, "Edge trên Windows"],
    [agents.webViewOnAndroid, "Trình duyệt trong app trên Android"],
    [agents.samsungOnAndroid, "Samsung Internet trên Android"],
    [agents.cocCocOnWindows, "Coc Coc trên Windows"],
  ])("given the user agent %s, when named, then it reads %j", (agent, label) => {
    expect(labelOf(agent)).toBe(label);
  });

  it.each([
    [{ browser: undefined, os: undefined }, "Thiết bị không rõ"],
    [{ browser: "Chrome", os: undefined }, "Chrome"],
    [{ browser: undefined, os: "Android" }, "Trình duyệt trên Android"],
  ])("given only part of a user agent, %j, when named, then it reads %j", (agent, label) => {
    expect(deviceLabelFor(agent)).toBe(label);
  });

  it("given an absurdly long browser name, when named, then the label still fits", () => {
    expect(deviceLabelFor({ browser: "x".repeat(500), os: "Android" })).toHaveLength(100);
  });
});

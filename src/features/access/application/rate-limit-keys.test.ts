import { describe, expect, it } from "vitest";

import { ipAddressSchema } from "@/features/access/domain/access-event";

import { clientNetwork } from "./rate-limit-keys";

function network(ip: string) {
  return clientNetwork(ipAddressSchema.parse(ip));
}

describe("clientNetwork", () => {
  it("given an IPv4 address, when keyed, then the address itself is the client", () => {
    expect(network("203.0.113.7")).toBe("203.0.113.7");
  });

  it("given a full IPv6 address, when keyed, then its /64 is the client", () => {
    expect(network("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:0db8:0001:0002::/64");
  });

  it("given a compressed IPv6 address, when keyed, then the missing groups count as zeros", () => {
    expect(network("2001:db8::1")).toBe("2001:0db8:0000:0000::/64");
  });

  it("given two addresses in one /64, when keyed, then they count as the same client", () => {
    expect(network("2001:db8:1:2::1")).toBe(network("2001:DB8:1:2:ffff:ffff:ffff:ffff"));
  });
});

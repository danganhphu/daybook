import type { IpAddress } from "@/features/access/domain/access-event";

// What a limit counts for one client. A device on IPv6 can hop across its whole /64, so the /64 is the client,
// not the address.
export function clientNetwork(ip: IpAddress): string {
  if (!ip.includes(":")) {
    return ip;
  }

  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === "" ? [] : tail.split(":");
  const groups = ip.includes("::")
    ? [
        ...headGroups,
        ...Array.from({ length: 8 - headGroups.length - tailGroups.length }, () => "0"),
        ...tailGroups,
      ]
    : headGroups;

  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, "0"))
    .join(":")}::/64`;
}

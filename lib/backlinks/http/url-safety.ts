import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeHttpTargetError extends Error {
  constructor(message = "HTTP target is not allowed.") {
    super(message);
    this.name = "UnsafeHttpTargetError";
  }
}

export type DnsLookupAddress = {
  address: string;
  family: 4 | 6;
};

export type DnsLookup = (hostname: string) => Promise<DnsLookupAddress[]>;

export type SafeHttpTarget = {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
};

const defaultDnsLookup: DnsLookup = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true }) as Promise<DnsLookupAddress[]>;

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function normalizeHostname(hostname: string): string {
  const withoutBrackets = stripIpv6Brackets(hostname.toLowerCase());
  if (withoutBrackets.endsWith(".") && isIP(withoutBrackets.slice(0, -1)) === 0) {
    return withoutBrackets.slice(0, -1);
  }
  return withoutBrackets;
}

function ipv4ToNumber(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const parsed = Number.parseInt(part, 10);
    if (parsed < 0 || parsed > 255) return null;
    value = (value << 8) + parsed;
  }
  return value >>> 0;
}

function ipv4InRange(value: number, base: string, bits: number): boolean {
  const baseValue = ipv4ToNumber(base);
  if (baseValue == null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function parseIpv6(address: string): bigint | null {
  const normalized = address.toLowerCase();
  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex >= 0) return null;

  const [head = "", tail = "", extra] = normalized.split("::");
  if (extra !== undefined) return null;

  const headParts = head.length === 0 ? [] : head.split(":");
  const tailParts = tail.length === 0 ? [] : tail.split(":");
  const hasCompression = normalized.includes("::");
  const missing = hasCompression ? 8 - headParts.length - tailParts.length : 0;
  const parts = hasCompression
    ? [...headParts, ...Array.from({ length: missing }, () => "0"), ...tailParts]
    : headParts;

  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }

  return parts.reduce((acc, part) => (acc << BigInt(16)) + BigInt(Number.parseInt(part, 16)), BigInt(0));
}

function ipv6InRange(value: bigint, base: string, bits: number): boolean {
  const baseValue = parseIpv6(base);
  if (baseValue == null) return false;
  const one = BigInt(1);
  const mask = bits === 0 ? BigInt(0) : ((one << BigInt(bits)) - one) << BigInt(128 - bits);
  return (value & mask) === (baseValue & mask);
}

function mappedIpv4FromIpv6(value: bigint): string | null {
  if ((value >> BigInt(32)) !== BigInt(0xffff)) return null;
  const ipv4 = Number(value & BigInt(0xffffffff));
  return [
    (ipv4 >>> 24) & 255,
    (ipv4 >>> 16) & 255,
    (ipv4 >>> 8) & 255,
    ipv4 & 255,
  ].join(".");
}

export function isUnsafeIpAddress(address: string): boolean {
  const normalized = stripIpv6Brackets(address);
  const family = isIP(normalized);

  if (family === 4) {
    const value = ipv4ToNumber(normalized);
    if (value == null) return true;
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([base, bits]) => ipv4InRange(value, base as string, bits as number));
  }

  if (family === 6) {
    const value = parseIpv6(normalized);
    if (value == null) return true;
    const mappedIpv4 = mappedIpv4FromIpv6(value);
    if (mappedIpv4 != null) return isUnsafeIpAddress(mappedIpv4);
    return (
      value === BigInt(0) ||
      value === BigInt(1) ||
      ipv6InRange(value, "64:ff9b::", 96) ||
      ipv6InRange(value, "100::", 64) ||
      ipv6InRange(value, "2001::", 23) ||
      ipv6InRange(value, "2001:db8::", 32) ||
      ipv6InRange(value, "fc00::", 7) ||
      ipv6InRange(value, "fe80::", 10) ||
      ipv6InRange(value, "ff00::", 8)
    );
  }

  return true;
}

export async function resolveSafeHttpTarget(
  value: string,
  dnsLookup: DnsLookup = defaultDnsLookup,
): Promise<SafeHttpTarget> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeHttpTargetError();
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeHttpTargetError();
  }
  if (url.username !== "" || url.password !== "") {
    throw new UnsafeHttpTargetError();
  }

  const hostname = normalizeHostname(url.hostname);
  if (hostname.length === 0 || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UnsafeHttpTargetError();
  }

  const directFamily = isIP(hostname);
  const addresses = directFamily === 0 ? await dnsLookup(hostname) : [{ address: hostname, family: directFamily as 4 | 6 }];
  if (addresses.length === 0) {
    throw new UnsafeHttpTargetError();
  }

  const normalizedAddresses = addresses.map((entry) => ({
    address: stripIpv6Brackets(entry.address),
    family: entry.family,
  }));
  if (normalizedAddresses.some((entry) => isUnsafeIpAddress(entry.address))) {
    throw new UnsafeHttpTargetError();
  }

  return {
    url,
    hostname,
    address: normalizedAddresses[0]!.address,
    family: normalizedAddresses[0]!.family,
  };
}

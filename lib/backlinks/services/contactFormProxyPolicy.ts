import { isIP } from "node:net";

export type ContactFormProxyDnsAddress = {
  address: string;
  family: 4 | 6;
};

export type ContactFormProxyConnectionPlan = {
  hostname: string;
  port: number;
  address: string;
  family: 4 | 6;
};

export type ContactFormProxyPolicyResult =
  | {
      ok: true;
      value: ContactFormProxyConnectionPlan;
    }
  | {
      ok: false;
      reason:
        | "invalid_authority"
        | "invalid_hostname"
        | "invalid_port"
        | "ip_literal_not_allowed"
        | "no_dns_addresses"
        | "invalid_dns_address"
        | "unsafe_dns_address";
    };

const DEFAULT_HTTPS_PORT = 443;

function normalizeHostname(value: string): string | null {
  const hostname = value.trim().toLowerCase().replace(/\.$/, "");

  if (!hostname) {
    return null;
  }

  if (
    hostname.includes("/") ||
    hostname.includes("\\") ||
    hostname.includes("@") ||
    hostname.includes(" ") ||
    hostname.includes("\t") ||
    hostname.includes("\n") ||
    hostname.includes("\r")
  ) {
    return null;
  }

  if (isIP(hostname) !== 0) {
    return null;
  }

  const labels = hostname.split(".");

  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9-]+$/.test(label) ||
        label.startsWith("-") ||
        label.endsWith("-"),
    )
  ) {
    return null;
  }

  if (hostname.length > 253) {
    return null;
  }

  return hostname;
}

function parsePort(value: string | undefined): number | null {
  if (value === undefined || value === "") {
    return DEFAULT_HTTPS_PORT;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

export function parseContactFormConnectAuthority(
  authority: string,
):
  | {
      ok: true;
      hostname: string;
      port: number;
    }
  | {
      ok: false;
      reason:
        | "invalid_authority"
        | "invalid_hostname"
        | "invalid_port"
        | "ip_literal_not_allowed";
    } {
  const trimmed = authority.trim();

  if (!trimmed || trimmed.includes("@")) {
    return { ok: false, reason: "invalid_authority" };
  }

  if (trimmed.startsWith("[")) {
    return { ok: false, reason: "ip_literal_not_allowed" };
  }

  const colonCount = (trimmed.match(/:/g) ?? []).length;

  if (colonCount > 1) {
    return { ok: false, reason: "ip_literal_not_allowed" };
  }

  const separator = trimmed.lastIndexOf(":");

  const rawHostname =
    separator === -1 ? trimmed : trimmed.slice(0, separator);

  const rawPort =
    separator === -1 ? undefined : trimmed.slice(separator + 1);

  if (isIP(rawHostname) !== 0) {
    return { ok: false, reason: "ip_literal_not_allowed" };
  }

  const hostname = normalizeHostname(rawHostname);

  if (!hostname) {
    return { ok: false, reason: "invalid_hostname" };
  }

  const port = parsePort(rawPort);

  if (port === null) {
    return { ok: false, reason: "invalid_port" };
  }

  return {
    ok: true,
    hostname,
    port,
  };
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255,
    )
  ) {
    return false;
  }

  const [a, b] = parts;

  if (a === 0) return false;
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;

  // IETF special-purpose / documentation / benchmarking ranges.
  if (a === 192 && b === 0 && parts[2] === 0) return false;
  if (a === 192 && b === 0 && parts[2] === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && parts[2] === 100) return false;
  if (a === 203 && b === 0 && parts[2] === 113) return false;

  // Multicast and reserved/future-use space.
  if (a >= 224) return false;

  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::" || normalized === "::1") {
    return false;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return false;
  }

  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return false;
  }

  // IPv4-mapped IPv6 must inherit the embedded IPv4 policy.
  const mappedIpv4Match = normalized.match(
    /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
  );
  if (mappedIpv4Match) {
    return isPublicIpv4(mappedIpv4Match[1]);
  }

  // Documentation and multicast IPv6 space are not valid public targets.
  if (
    normalized.startsWith("2001:db8:") ||
    normalized === "2001:db8::" ||
    normalized.startsWith("ff")
  ) {
    return false;
  }

  return true;
}

export function isSafeContactFormProxyAddress(
  address: ContactFormProxyDnsAddress,
): boolean {
  const actualFamily = isIP(address.address);

  if (actualFamily !== address.family) {
    return false;
  }

  if (address.family === 4) {
    return isPublicIpv4(address.address);
  }

  return isPublicIpv6(address.address);
}

export function buildContactFormProxyConnectionPlan(input: {
  authority: string;
  addresses: readonly ContactFormProxyDnsAddress[];
}): ContactFormProxyPolicyResult {
  const parsed = parseContactFormConnectAuthority(input.authority);

  if (!parsed.ok) {
    return parsed;
  }

  if (input.addresses.length === 0) {
    return { ok: false, reason: "no_dns_addresses" };
  }

  for (const candidate of input.addresses) {
    if (isIP(candidate.address) !== candidate.family) {
      return { ok: false, reason: "invalid_dns_address" };
    }

    if (!isSafeContactFormProxyAddress(candidate)) {
      return { ok: false, reason: "unsafe_dns_address" };
    }
  }

  const selected = [...input.addresses].sort((left, right) => {
    if (left.family !== right.family) {
      return left.family - right.family;
    }

    return left.address.localeCompare(right.address);
  })[0];

  return {
    ok: true,
    value: {
      hostname: parsed.hostname,
      port: parsed.port,
      address: selected.address,
      family: selected.family,
    },
  };
}

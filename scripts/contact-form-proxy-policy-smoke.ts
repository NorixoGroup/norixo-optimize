import assert from "node:assert/strict";

import {
  buildContactFormProxyConnectionPlan,
  isSafeContactFormProxyAddress,
  parseContactFormConnectAuthority,
} from "../lib/backlinks/services/contactFormProxyPolicy";

function main(): void {
  assert.deepEqual(
    parseContactFormConnectAuthority("Example.COM:443"),
    {
      ok: true,
      hostname: "example.com",
      port: 443,
    },
  );

  assert.deepEqual(
    parseContactFormConnectAuthority("example.com"),
    {
      ok: true,
      hostname: "example.com",
      port: 443,
    },
  );

  assert.equal(
    parseContactFormConnectAuthority("user@example.com:443").ok,
    false,
  );

  assert.deepEqual(
    parseContactFormConnectAuthority("127.0.0.1:443"),
    {
      ok: false,
      reason: "ip_literal_not_allowed",
    },
  );

  assert.deepEqual(
    parseContactFormConnectAuthority("[::1]:443"),
    {
      ok: false,
      reason: "ip_literal_not_allowed",
    },
  );

  assert.equal(
    isSafeContactFormProxyAddress({
      address: "8.8.8.8",
      family: 4,
    }),
    true,
  );

  assert.equal(
    isSafeContactFormProxyAddress({
      address: "127.0.0.1",
      family: 4,
    }),
    false,
  );

  assert.equal(
    isSafeContactFormProxyAddress({
      address: "10.0.0.1",
      family: 4,
    }),
    false,
  );

  assert.equal(
    isSafeContactFormProxyAddress({
      address: "169.254.1.1",
      family: 4,
    }),
    false,
  );

  assert.equal(
    isSafeContactFormProxyAddress({
      address: "::1",
      family: 6,
    }),
    false,
  );

  assert.equal(
    isSafeContactFormProxyAddress({
      address: "fc00::1",
      family: 6,
    }),
    false,
  );

  const valid = buildContactFormProxyConnectionPlan({
    authority: "example.com:443",
    addresses: [
      { address: "2001:4860:4860::8888", family: 6 },
      { address: "8.8.8.8", family: 4 },
    ],
  });

  assert.deepEqual(valid, {
    ok: true,
    value: {
      hostname: "example.com",
      port: 443,
      address: "8.8.8.8",
      family: 4,
    },
  });

  const mixed = buildContactFormProxyConnectionPlan({
    authority: "example.com:443",
    addresses: [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ],
  });

  assert.deepEqual(mixed, {
    ok: false,
    reason: "unsafe_dns_address",
  });

  const empty = buildContactFormProxyConnectionPlan({
    authority: "example.com:443",
    addresses: [],
  });

  assert.deepEqual(empty, {
    ok: false,
    reason: "no_dns_addresses",
  });

  console.log("PASS contact-form-proxy-policy-smoke");
}

main();

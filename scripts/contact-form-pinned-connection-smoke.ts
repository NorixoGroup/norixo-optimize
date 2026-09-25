import assert from "node:assert/strict";

import {
  buildContactFormPinnedConnectionTarget,
} from "../lib/backlinks/services/contactFormProxyPolicy";

const ipv4 = buildContactFormPinnedConnectionTarget({
  authorityHostname: "publisher.example",
  selectedAddress: {
    address: "93.184.216.34",
    family: 4,
  },
  port: 443,
});

assert.deepEqual(ipv4, {
  authorityHostname: "publisher.example",
  socketAddress: "93.184.216.34",
  socketFamily: 4,
  port: 443,
});

assert.equal(ipv4.socketAddress, "93.184.216.34");
assert.notEqual(ipv4.socketAddress, ipv4.authorityHostname);

const ipv6 = buildContactFormPinnedConnectionTarget({
  authorityHostname: "publisher.example",
  selectedAddress: {
    address: "2606:2800:220:1:248:1893:25c8:1946",
    family: 6,
  },
  port: 443,
});

assert.deepEqual(ipv6, {
  authorityHostname: "publisher.example",
  socketAddress: "2606:2800:220:1:248:1893:25c8:1946",
  socketFamily: 6,
  port: 443,
});

assert.equal(ipv6.socketFamily, 6);
assert.equal(ipv6.port, 443);

console.log("CONTACT_FORM_PINNED_CONNECTION_SMOKE=PASS");
console.log("IPV4_PINNING=PASS");
console.log("IPV6_PINNING=PASS");
console.log("AUTHORITY_SOCKET_SEPARATION=PASS");
console.log("NETWORK_CALL_EXECUTED=NO");

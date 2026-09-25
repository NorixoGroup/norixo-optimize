import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  buildContactFormPinnedSocketConnectOptions,
  openContactFormPinnedSocket,
  type ContactFormPinnedSocketConnectOptions,
  type ContactFormPinnedSocketLike,
} from "../lib/backlinks/services/contactFormPinnedSocket";
import type { ContactFormPinnedConnectionTarget } from "../lib/backlinks/services/contactFormProxyPolicy";

class FakeSocket extends EventEmitter {
  destroyed = false;
  timeoutMs: number | null = null;

  setTimeout(timeout: number) {
    this.timeoutMs = timeout;
    return this;
  }

  destroy() {
    this.destroyed = true;
    return this;
  }
}

const ipv4: ContactFormPinnedConnectionTarget = {
  authorityHostname: "publisher.example",
  socketAddress: "93.184.216.34",
  socketFamily: 4,
  port: 443,
};

const ipv6: ContactFormPinnedConnectionTarget = {
  authorityHostname: "publisher.example",
  socketAddress: "2606:2800:220:1:248:1893:25c8:1946",
  socketFamily: 6,
  port: 443,
};

assert.deepEqual(buildContactFormPinnedSocketConnectOptions(ipv4), {
  host: "93.184.216.34",
  port: 443,
  family: 4,
});

assert.deepEqual(buildContactFormPinnedSocketConnectOptions(ipv6), {
  host: "2606:2800:220:1:248:1893:25c8:1946",
  port: 443,
  family: 6,
});

assert.notEqual(
  buildContactFormPinnedSocketConnectOptions(ipv4).host,
  ipv4.authorityHostname,
);

let captured: ContactFormPinnedSocketConnectOptions | null = null;
const connectedSocket = new FakeSocket();

async function main() {
  const connectedPromise = openContactFormPinnedSocket(
    ipv4,
    { connectTimeoutMs: 1000, idleTimeoutMs: 2000 },
    (options) => {
      captured = options;
      queueMicrotask(() => connectedSocket.emit("connect"));
      return connectedSocket as unknown as ContactFormPinnedSocketLike;
    },
  );

  const result = await connectedPromise;

  assert.equal(result, connectedSocket);
  assert.deepEqual(captured, {
    host: "93.184.216.34",
    port: 443,
    family: 4,
  });
  assert.equal(connectedSocket.timeoutMs, 2000);
  assert.equal(connectedSocket.destroyed, false);

  connectedSocket.emit("timeout");
  assert.equal(connectedSocket.destroyed, true);

  const failedSocket = new FakeSocket();

  await assert.rejects(
    openContactFormPinnedSocket(
      ipv4,
      { connectTimeoutMs: 1000, idleTimeoutMs: 2000 },
      () => {
        queueMicrotask(() =>
          failedSocket.emit("error", new Error("synthetic failure")),
        );
        return failedSocket as unknown as ContactFormPinnedSocketLike;
      },
    ),
    /synthetic failure/,
  );

  assert.equal(failedSocket.destroyed, true);

  const timeoutSocket = new FakeSocket();

  await assert.rejects(
    openContactFormPinnedSocket(
      ipv4,
      { connectTimeoutMs: 1, idleTimeoutMs: 2000 },
      () => timeoutSocket as unknown as ContactFormPinnedSocketLike,
    ),
    /CONTACT_FORM_PINNED_SOCKET_CONNECT_TIMEOUT/,
  );

  assert.equal(timeoutSocket.destroyed, true);

  await assert.rejects(
    openContactFormPinnedSocket(
      ipv4,
      { connectTimeoutMs: 0, idleTimeoutMs: 2000 },
      () => {
        throw new Error("connector must not execute");
      },
    ),
    /CONTACT_FORM_PINNED_SOCKET_TIMEOUT_INVALID/,
  );

  console.log("CONTACT_FORM_PINNED_SOCKET_SMOKE=PASS");
  console.log("REAL_SOCKET_CREATED=NO");
  console.log("DNS_LOOKUP_IN_SOCKET_RUNTIME=NO");
  console.log("HOSTNAME_FALLBACK=NO");
  console.log("IPV4_PINNING=PASS");
  console.log("IPV6_PINNING=PASS");
  console.log("CONNECT_FAILURE_FAIL_CLOSED=PASS");
  console.log("CONNECT_TIMEOUT_DESTROYS_SOCKET=PASS");
  console.log("IDLE_TIMEOUT_DESTROYS_SOCKET=PASS");
  console.log("BROWSER_WIRING=NO");
  console.log("PROXY_CONNECT_WIRING=NO");
  console.log("EXTERNAL_NETWORK=NO");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

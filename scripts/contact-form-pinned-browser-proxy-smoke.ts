import assert from "node:assert/strict";
import { createServer, connect, type Socket } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { startContactFormPinnedBrowserProxy } from "../lib/backlinks/services/contactFormPinnedBrowserProxy";
import type { ContactFormPinnedConnectionTarget } from "../lib/backlinks/services/contactFormProxyPolicy";

const target: ContactFormPinnedConnectionTarget = {
  authorityHostname: "publisher.example",
  socketAddress: "93.184.216.34",
  socketFamily: 4,
  port: 443,
};

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

async function close(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function connectRequest(port: number, authority: string): Promise<{ socket: Socket; response: string }> {
  const socket = connect({ host: "127.0.0.1", port });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  const response = await new Promise<string>((resolve, reject) => {
    let value = "";
    socket.on("data", (chunk) => {
      value += chunk.toString("ascii");
      if (value.includes("\r\n\r\n")) resolve(value);
    });
    socket.once("error", reject);
    socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
  });
  return { socket, response };
}

async function main() {
  const upstream = createServer((socket) => socket.resume());
  const upstreamPort = await listen(upstream);
  const observedTargets: ContactFormPinnedConnectionTarget[] = [];
  const proxy = await startContactFormPinnedBrowserProxy({
    target,
    openPinnedSocket: async (receivedTarget) => {
      observedTargets.push(receivedTarget);
      const socket = connect({ host: "127.0.0.1", port: upstreamPort });
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
      return socket;
    },
  });
  try {
    assert.equal(proxy.host, "127.0.0.1");
    const expected = await connectRequest(proxy.port, "publisher.example:443");
    assert.match(expected.response, /^HTTP\/1\.1 200 Connection Established/);
    assert.deepEqual(observedTargets, [target]);
    expected.socket.destroy();

    const wrongHost = await connectRequest(proxy.port, "other.example:443");
    assert.match(wrongHost.response, /^HTTP\/1\.1 403 Forbidden/);
    wrongHost.socket.destroy();
    const wrongPort = await connectRequest(proxy.port, "publisher.example:8443");
    assert.match(wrongPort.response, /^HTTP\/1\.1 403 Forbidden/);
    wrongPort.socket.destroy();
    assert.equal(observedTargets.length, 1);
  } finally {
    await proxy.close();
    await close(upstream);
  }

  const failingProxy = await startContactFormPinnedBrowserProxy({
    target,
    openPinnedSocket: async () => {
      throw new Error("synthetic upstream failure");
    },
  });
  try {
    const failed = await connectRequest(failingProxy.port, "publisher.example:443");
    assert.match(failed.response, /^HTTP\/1\.1 502 Bad Gateway/);
    failed.socket.destroy();
  } finally {
    await failingProxy.close();
  }

  const proxySource = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormPinnedBrowserProxy.ts"), "utf8");
  const workerSource = readFileSync(join(process.cwd(), "lib/backlinks/services/contactFormNavigationWorker.ts"), "utf8");
  assert.doesNotMatch(proxySource, /dns\.(lookup|resolve)|node:dns|connect\(\{\s*host:\s*target\.authorityHostname/);
  assert.match(proxySource, /openContactFormPinnedSocket/);
  assert.match(workerSource, /startContactFormPinnedBrowserProxy/);
  assert.match(workerSource, /--proxy-server=http:\/\/\$\{proxy\.host\}:\$\{proxy\.port\}/);
  assert.match(workerSource, /--proxy-bypass-list=<-loopback>/);
  assert.match(workerSource, /--disable-quic/);
  assert.match(workerSource, /openContext\(\{ pinnedTarget \}\)/);

  console.log("CONTACT_FORM_PINNED_BROWSER_PROXY_SMOKE=PASS");
  console.log("EXPECTED_CONNECT=PASS");
  console.log("WRONG_HOST_AND_PORT_REJECTED=PASS");
  console.log("PINNED_TARGET_PRESERVED=PASS");
  console.log("UPSTREAM_FAILURE_FAIL_CLOSED=PASS");
  console.log("CLEANUP=PASS");
  console.log("EXTERNAL_NETWORK=NO");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { createServer, type Server, type Socket } from "node:net";

import {
  parseContactFormConnectAuthority,
  type ContactFormPinnedConnectionTarget,
} from "@/lib/backlinks/services/contactFormProxyPolicy";
import {
  createNodeContactFormPinnedSocketConnector,
  openContactFormPinnedSocket,
} from "@/lib/backlinks/services/contactFormPinnedSocket";

const MAX_CONNECT_HEADER_BYTES = 8 * 1024;
const LOOPBACK_HOST = "127.0.0.1";

export type ContactFormPinnedBrowserProxy = Readonly<{
  host: typeof LOOPBACK_HOST;
  port: number;
  close: () => Promise<void>;
}>;

export type ContactFormPinnedBrowserProxyOptions = Readonly<{
  target: ContactFormPinnedConnectionTarget;
  connectTimeoutMs?: number;
  idleTimeoutMs?: number;
  openPinnedSocket?: (target: ContactFormPinnedConnectionTarget) => Promise<Socket>;
}>;

function isExpectedAuthority(authority: string, target: ContactFormPinnedConnectionTarget): boolean {
  const parsed = parseContactFormConnectAuthority(authority);
  return parsed.ok && parsed.hostname === target.authorityHostname && parsed.port === target.port;
}

function writeAndClose(socket: Socket, status: number, reason: string): void {
  socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
}

function defaultOpenPinnedSocket(target: ContactFormPinnedConnectionTarget, connectTimeoutMs: number, idleTimeoutMs: number): Promise<Socket> {
  return openContactFormPinnedSocket(
    target,
    { connectTimeoutMs, idleTimeoutMs },
    createNodeContactFormPinnedSocketConnector(),
  ) as Promise<Socket>;
}

async function listenLoopback(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: LOOPBACK_HOST, port: 0, exclusive: true });
  });
  const address = server.address();
  if (address == null || typeof address === "string" || address.address !== LOOPBACK_HOST || !Number.isInteger(address.port) || address.port < 1) {
    throw new Error("CONTACT_FORM_PINNED_PROXY_START_FAILED");
  }
  return address.port;
}

export async function startContactFormPinnedBrowserProxy(options: ContactFormPinnedBrowserProxyOptions): Promise<ContactFormPinnedBrowserProxy> {
  const expectedTarget = parseContactFormConnectAuthority(`${options.target.authorityHostname}:${options.target.port}`);
  if (!expectedTarget.ok) throw new Error("CONTACT_FORM_PINNED_PROXY_TARGET_INVALID");

  const connectTimeoutMs = options.connectTimeoutMs ?? 15_000;
  const idleTimeoutMs = options.idleTimeoutMs ?? 60_000;
  const openPinnedSocket = options.openPinnedSocket ?? ((target) => defaultOpenPinnedSocket(target, connectTimeoutMs, idleTimeoutMs));
  const sockets = new Set<Socket>();
  const server = createServer((browserSocket) => {
    sockets.add(browserSocket);
    browserSocket.once("close", () => sockets.delete(browserSocket));
    browserSocket.setTimeout(connectTimeoutMs, () => browserSocket.destroy());

    let buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_CONNECT_HEADER_BYTES) {
        browserSocket.off("data", onData);
        writeAndClose(browserSocket, 400, "Bad Request");
        return;
      }
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      browserSocket.off("data", onData);
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const [requestLine] = header.split("\r\n");
      const match = requestLine?.match(/^CONNECT ([^\s]+) HTTP\/1\.[01]$/);
      if (match == null) {
        writeAndClose(browserSocket, 400, "Bad Request");
        return;
      }
      if (!isExpectedAuthority(match[1], options.target)) {
        writeAndClose(browserSocket, 403, "Forbidden");
        return;
      }
      void openPinnedSocket(options.target).then(
        (upstreamSocket) => {
          sockets.add(upstreamSocket);
          upstreamSocket.once("close", () => sockets.delete(upstreamSocket));
          upstreamSocket.once("error", () => browserSocket.destroy());
          browserSocket.once("error", () => upstreamSocket.destroy());
          browserSocket.setTimeout(0);
          browserSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          const remainder = buffer.subarray(headerEnd + 4);
          if (remainder.length > 0) upstreamSocket.write(remainder);
          browserSocket.pipe(upstreamSocket);
          upstreamSocket.pipe(browserSocket);
        },
        () => writeAndClose(browserSocket, 502, "Bad Gateway"),
      );
    };
    browserSocket.on("data", onData);
  });

  let port: number;
  try {
    port = await listenLoopback(server);
  } catch (error) {
    for (const socket of sockets) socket.destroy();
    server.close();
    throw error instanceof Error ? error : new Error("CONTACT_FORM_PINNED_PROXY_START_FAILED");
  }

  let closePromise: Promise<void> | null = null;
  return {
    host: LOOPBACK_HOST,
    port,
    close: () => {
      closePromise ??= (async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      })();
      return closePromise;
    },
  };
}

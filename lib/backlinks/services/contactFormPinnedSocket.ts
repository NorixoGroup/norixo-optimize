import { connect as nodeNetConnect, type Socket } from "node:net";

import type { ContactFormPinnedConnectionTarget } from "@/lib/backlinks/services/contactFormProxyPolicy";

export type ContactFormPinnedSocketConnectOptions = Readonly<{
  host: string;
  port: number;
  family: 4 | 6;
}>;

export type ContactFormPinnedSocketLike = Pick<
  Socket,
  "once" | "setTimeout" | "destroy"
>;

export type ContactFormPinnedSocketConnector = (
  options: ContactFormPinnedSocketConnectOptions,
) => ContactFormPinnedSocketLike;

export type ContactFormPinnedSocketOptions = Readonly<{
  connectTimeoutMs: number;
  idleTimeoutMs: number;
}>;

export function buildContactFormPinnedSocketConnectOptions(
  target: ContactFormPinnedConnectionTarget,
): ContactFormPinnedSocketConnectOptions {
  return {
    host: target.socketAddress,
    port: target.port,
    family: target.socketFamily,
  };
}

export function createNodeContactFormPinnedSocketConnector(): ContactFormPinnedSocketConnector {
  return (options) => nodeNetConnect(options);
}

export function openContactFormPinnedSocket(
  target: ContactFormPinnedConnectionTarget,
  options: ContactFormPinnedSocketOptions,
  connect: ContactFormPinnedSocketConnector,
): Promise<ContactFormPinnedSocketLike> {
  if (
    !Number.isInteger(options.connectTimeoutMs) ||
    options.connectTimeoutMs <= 0 ||
    !Number.isInteger(options.idleTimeoutMs) ||
    options.idleTimeoutMs <= 0
  ) {
    return Promise.reject(
      new Error("CONTACT_FORM_PINNED_SOCKET_TIMEOUT_INVALID"),
    );
  }

  const connectOptions = buildContactFormPinnedSocketConnectOptions(target);

  return new Promise((resolve, reject) => {
    let settled = false;
    let socket: ContactFormPinnedSocketLike;

    try {
      socket = connect(connectOptions);
    } catch (error) {
      reject(error);
      return;
    }

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error("CONTACT_FORM_PINNED_SOCKET_CONNECT_TIMEOUT"));
    }, options.connectTimeoutMs);

    socket.once("connect", () => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);

      socket.setTimeout(options.idleTimeoutMs);
      socket.once("timeout", () => {
        socket.destroy();
      });

      resolve(socket);
    });

    socket.once("error", (error: Error) => {
      if (settled) {
        socket.destroy();
        return;
      }

      settled = true;
      clearTimeout(connectTimer);
      socket.destroy();
      reject(error);
    });
  });
}

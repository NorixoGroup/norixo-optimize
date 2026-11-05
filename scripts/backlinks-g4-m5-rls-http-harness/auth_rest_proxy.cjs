#!/usr/bin/env node
// G4-M5 HTTP harness: local responder standing in for Supabase.
//
// IMPORTANT: this is a SYNTHETIC SIMULATOR, not real Supabase Auth
// (GoTrue). It only verifies the HMAC-SHA256 signature of locally-minted
// JWTs (see mint_jwt.cjs) against G4M5_HTTP_JWT_SECRET and echoes back a
// fabricated user object. It never contacts any Supabase service.
//
// - GET /auth/v1/user  -> handled locally (the simulator above).
// - everything else (/rest/v1/*) -> reverse-proxied verbatim to a real,
//   locally-run PostgREST instance on 127.0.0.1:G4M5_PGRST_PORT.
//
// Node built-ins only (http, crypto) -- no new dependency.
"use strict";

const http = require("http");
const crypto = require("crypto");

const PROXY_PORT = Number(process.env.G4M5_PROXY_PORT);
const PGRST_PORT = Number(process.env.G4M5_PGRST_PORT);
const SECRET = process.env.G4M5_HTTP_JWT_SECRET;

if (!PROXY_PORT || !PGRST_PORT || !SECRET) {
  console.error("Missing G4M5_PROXY_PORT / G4M5_PGRST_PORT / G4M5_HTTP_JWT_SECRET");
  process.exit(1);
}

function b64urlDecode(segment) {
  return Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function verifySynthetic(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = b64url(
    crypto.createHmac("sha256", SECRET).update(`${headerPart}.${payloadPart}`).digest(),
  );
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signaturePart))) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadPart).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.exp === "number" && Math.floor(Date.now() / 1000) > payload.exp) {
    return null;
  }
  return payload;
}

function handleSyntheticUser(req, res) {
  const authorization = req.headers["authorization"] || "";
  const token = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null;
  const payload = token ? verifySynthetic(token) : null;

  if (!payload || payload.role !== "authenticated" || !payload.sub) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({
      error: "invalid_token",
      message: "G4-M5 synthetic auth simulator (NOT real Supabase/GoTrue): token missing, invalid, or not role=authenticated.",
    }));
    return;
  }

  const nowIso = new Date().toISOString();
  const user = {
    id: payload.sub,
    aud: "authenticated",
    role: "authenticated",
    email: payload.email || null,
    email_confirmed_at: payload.email_confirmed_at || nowIso,
    phone: "",
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: nowIso,
    updated_at: nowIso,
  };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(user));
}

function proxyToPostgrest(req, res) {
  // supabase-js sends table/rpc requests to `${url}/rest/v1/...` (the real
  // Supabase gateway's prefix). Real PostgREST itself serves tables and
  // rpc/* at its ROOT path with no /rest/v1 prefix, so that prefix must be
  // stripped before forwarding, or every request 404s.
  const originalUrl = req.url || "/";
  const forwardedPath = originalUrl.replace(/^\/rest\/v1(?=\/|$)/, "") || "/";
  const proxyReq = http.request(
    {
      host: "127.0.0.1",
      port: PGRST_PORT,
      path: forwardedPath,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "postgrest_proxy_error", message: String(err && err.message) }));
  });
  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const path = (req.url || "").split("?")[0];
  if (req.method === "GET" && path === "/auth/v1/user") {
    handleSyntheticUser(req, res);
    return;
  }
  proxyToPostgrest(req, res);
});

server.listen(PROXY_PORT, "127.0.0.1", () => {
  console.log(
    `G4-M5 HTTP harness: synthetic /auth/v1/user simulator (NOT real Supabase) + PostgREST reverse proxy listening on 127.0.0.1:${PROXY_PORT} -> PostgREST 127.0.0.1:${PGRST_PORT}`,
  );
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));

#!/usr/bin/env node
// G4-M5 HTTP harness: mints a SYNTHETIC HS256 JWT signed with
// G4M5_HTTP_JWT_SECRET. Not Supabase/GoTrue-issued. Node's built-in
// `crypto` only -- no new dependency.
//
// Usage: node mint_jwt.cjs '{"role":"authenticated","sub":"...","email":"..."}'
// Prints only the token to stdout. Never prints the secret.
"use strict";

const crypto = require("crypto");

const secret = process.env.G4M5_HTTP_JWT_SECRET;
if (!secret) {
  console.error("Missing G4M5_HTTP_JWT_SECRET");
  process.exit(1);
}

const claimsArg = process.argv[2];
if (!claimsArg) {
  console.error("Usage: node mint_jwt.cjs '<json claims>'");
  process.exit(1);
}

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const claims = JSON.parse(claimsArg);
const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = Object.assign(
  { iss: "g4m5-http-harness-synthetic", iat: now, exp: now + 3600 },
  claims,
);

const headerPart = b64url(Buffer.from(JSON.stringify(header)));
const payloadPart = b64url(Buffer.from(JSON.stringify(payload)));
const signature = b64url(
  crypto.createHmac("sha256", secret).update(`${headerPart}.${payloadPart}`).digest(),
);

process.stdout.write(`${headerPart}.${payloadPart}.${signature}`);

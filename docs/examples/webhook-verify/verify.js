#!/usr/bin/env node
"use strict";

/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const http = require("node:http");

const secret = process.env.CONVO_WEBHOOK_SECRET;
const port = Number(process.env.PORT || 3000);
const toleranceSeconds = 300;

if (!secret) {
  console.error("Set CONVO_WEBHOOK_SECRET before starting the server.");
  process.exit(1);
}

function parseSignatureHeader(header) {
  if (!header) return null;

  const fields = new Map();
  for (const part of header.split(",")) {
    const pieces = part.split("=");
    if (pieces.length !== 2) return null;
    fields.set(pieces[0], pieces[1]);
  }

  const timestampRaw = fields.get("t");
  const signature = fields.get("v1");
  if (!timestampRaw || !/^\d+$/.test(timestampRaw)) return null;
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return null;

  return {
    timestamp: Number(timestampRaw),
    signature,
  };
}

function signBody(timestamp, body) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
}

function timingSafeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifySignature(header, body) {
  const parsed = parseSignatureHeader(header);
  if (!parsed || !Number.isSafeInteger(parsed.timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) return false;

  const expected = signBody(parsed.timestamp, body);
  return timingSafeEqualHex(parsed.signature, expected);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "text/plain" });
    response.end("Method not allowed");
    return;
  }

  const body = await readBody(request);
  const signature = request.headers["x-convo-signature"];

  if (!verifySignature(Array.isArray(signature) ? signature[0] : signature, body)) {
    response.writeHead(401, { "Content-Type": "text/plain" });
    response.end("Invalid signature");
    return;
  }

  const payload = JSON.parse(body);
  console.log("Verified Convo webhook:", payload.event);
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("OK");
});

server.listen(port, () => {
  console.log(`Listening for Convo webhooks on http://localhost:${port}`);
});

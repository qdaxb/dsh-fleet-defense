import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FleetTelemetry } from "./telemetry.js";

export const name = "ai-fleet-defense";
export const inject = ["sessions", "webServer"];

const STATE_PATH = "/ai-fleet-defense/v1/state";
const BACKGROUND_PATH = "/ai-fleet-defense/assets/neural-rift-battlefield.png";
const BACKGROUND_FILE = fileURLToPath(
  new URL("./assets/neural-rift-battlefield.png", import.meta.url),
);

export function apply(ctx) {
  const telemetry = new FleetTelemetry();
  ctx.on("session/event", (session, event) => telemetry.handle(session, event));
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: STATE_PATH,
        handler: (req, res) => serveState(req, res, telemetry),
      }),
    `ai-fleet-defense: ${STATE_PATH}`,
  );
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: BACKGROUND_PATH,
        handler: (req, res) => serveBackground(req, res),
      }),
    `ai-fleet-defense: ${BACKGROUND_PATH}`,
  );
}

function serveState(req, res, telemetry) {
  if (!trustedBrowserRequest(req)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }
  sendJson(res, 200, telemetry.snapshot(), req.method === "HEAD");
}

function serveBackground(req, res) {
  if (!trustedBrowserRequest(req)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end();
    return;
  }
  const body = readFileSync(BACKGROUND_FILE);
  res.writeHead(200, {
    "content-type": "image/png",
    "cache-control": "public, max-age=3600",
    "content-length": body.byteLength,
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

function trustedBrowserRequest(req) {
  const remoteAddress = req.socket?.remoteAddress ?? "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remoteAddress))
    return false;
  const origin = singleHeader(req.headers.origin);
  const host = singleHeader(req.headers.host);
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function sendJson(res, status, value, head = false) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  res.end(head ? undefined : body);
}

function singleHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

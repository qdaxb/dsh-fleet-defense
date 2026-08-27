import assert from "node:assert/strict";
import test from "node:test";
import { FleetTelemetry } from "./telemetry.js";

test("aggregates token speed across active sessions with capped parallel synergy", () => {
  let now = 1000;
  const telemetry = new FleetTelemetry(() => now);

  for (let index = 1; index <= 6; index += 1) {
    const session = { id: `session-${index}` };
    telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
    now += 1000;
    telemetry.handle(session, usageEvent(20));
  }

  const snapshot = telemetry.snapshot();
  assert.equal(snapshot.activeSessions, 6);
  assert.equal(snapshot.synergy, 1.48);
  assert.ok(snapshot.tokensPerSecond > 0);
  assert.ok(snapshot.ultimateChargePerSecond > 4);
});

test("uses cumulative usage deltas and closes firepower at turn end", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  now = 1000;
  telemetry.handle(session, usageEvent(10));
  now = 2000;
  telemetry.handle(session, usageEvent(25));
  assert.ok(telemetry.snapshot().tokensPerSecond >= 10);

  telemetry.handle(session, {
    type: "turn/end",
    data: { turn: 1, reason: { kind: "completed" } },
  });
  assert.equal(telemetry.snapshot().tokensPerSecond, 0);
  assert.equal(telemetry.snapshot().activeSessions, 0);
});

test("uses streamed model deltas for live throughput and lets idle output decay", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  now = 1000;
  telemetry.handle(session, deltaEvent("text-delta", "streaming output"));
  now = 1100;
  telemetry.handle(session, deltaEvent("reasoning-delta", "分析中"));
  assert.ok(telemetry.snapshot().tokensPerSecond > 0);

  now = 5000;
  assert.equal(telemetry.snapshot().tokensPerSecond, 0);
  assert.equal(telemetry.snapshot().activeSessions, 1);
});

test("uses a recent exact usage sample when a runtime has no text deltas", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  now = 45000;
  telemetry.handle(session, usageEvent(450));
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);

  now = 51000;
  assert.equal(telemetry.snapshot().tokensPerSecond, 0);
});

function usageEvent(outputTokens) {
  return {
    type: "assistant/chunk",
    data: {
      turn: 1,
      step: 1,
      chunk: {
        type: "usage",
        usage: { inputTokens: 10, outputTokens },
      },
    },
  };
}

function deltaEvent(type, text) {
  return {
    type: "assistant/chunk",
    data: {
      turn: 1,
      step: 1,
      chunk: { type, index: 0, text },
    },
  };
}

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

test("uses step-local usage and closes firepower at turn end", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  now = 1000;
  telemetry.handle(session, stepStartEvent(1));
  telemetry.handle(session, usageEvent(10, 1));
  now = 2000;
  telemetry.handle(session, stepStartEvent(2));
  now = 3000;
  telemetry.handle(session, usageEvent(15, 2));
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
  telemetry.handle(session, stepStartEvent(1));
  now = 45000;
  telemetry.handle(session, usageEvent(450, 1));
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);

  now = 51000;
  assert.equal(telemetry.snapshot().tokensPerSecond, 0);
});

test("smooths model deltas that arrive in the same event-loop burst", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  telemetry.handle(session, stepStartEvent(1));
  now = 1000;
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(100)));
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(100)));
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(100)));

  assert.equal(telemetry.snapshot().tokensPerSecond, 300);
});

test("treats usage as step-local instead of cumulative across a turn", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  telemetry.handle(session, stepStartEvent(1));
  now = 10000;
  telemetry.handle(session, usageEvent(100, 1));
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);

  telemetry.handle(session, stepStartEvent(2));
  now = 12000;
  telemetry.handle(session, usageEvent(20, 2));
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);
});

test("counts streamed tool call arguments as model output", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  telemetry.handle(session, stepStartEvent(1));
  now = 1000;
  telemetry.handle(session, deltaEvent("tool-call-delta", "x".repeat(400)));

  assert.equal(telemetry.snapshot().tokensPerSecond, 100);
});

function usageEvent(outputTokens, step = 1) {
  return {
    type: "assistant/chunk",
    data: {
      turn: 1,
      step,
      chunk: {
        type: "usage",
        usage: { inputTokens: 10, outputTokens },
      },
    },
  };
}

function stepStartEvent(step) {
  return {
    type: "step/start",
    data: { turn: 1, step },
  };
}

function deltaEvent(type, text) {
  return {
    type: "assistant/chunk",
    data: {
      turn: 1,
      step: 1,
      chunk:
        type === "tool-call-delta"
          ? { type, index: 0, argumentsDelta: text }
          : { type, index: 0, text },
    },
  };
}

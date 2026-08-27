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
  assert.equal(snapshot.synergy, 1.64);
  assert.ok(snapshot.tokensPerSecond > 0);
  assert.ok(snapshot.ultimateChargePerSecond > 5.1);
});

test("reaches full four-unit combat synergy progressively", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const synergies = [];

  for (let index = 1; index <= 4; index += 1) {
    telemetry.handle(
      { id: `session-${index}` },
      { type: "turn/start", data: { turn: 1 } },
    );
    synergies.push(telemetry.snapshot().synergy);
  }

  assert.deepEqual(synergies, [1, 1.16, 1.32, 1.48]);
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

test("keeps the latest streamed throughput across sparse reasoning updates", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  now = 1000;
  telemetry.handle(session, deltaEvent("text-delta", "streaming output"));
  now = 1100;
  telemetry.handle(session, deltaEvent("reasoning-delta", "分析中"));
  const initialRate = telemetry.snapshot().tokensPerSecond;
  assert.ok(initialRate > 0);

  now = 5000;
  assert.ok(telemetry.snapshot().tokensPerSecond > 0);
  assert.equal(telemetry.snapshot().activeSessions, 1);

  now = 8000;
  telemetry.handle(session, deltaEvent("reasoning-delta", "继续分析"));
  const sparseRate = telemetry.snapshot().tokensPerSecond;
  assert.ok(sparseRate > 0);
  assert.ok(sparseRate < initialRate);
});

test("keeps an exact usage sample while a turn remains active", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  telemetry.handle(session, stepStartEvent(1));
  now = 45000;
  telemetry.handle(session, usageEvent(450, 1));
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);

  now = 51000;
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);

  telemetry.handle(session, {
    type: "turn/end",
    data: { turn: 1, reason: { kind: "completed" } },
  });
  assert.equal(telemetry.snapshot().tokensPerSecond, 0);
});

test("averages model delta bursts over the full step duration", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  telemetry.handle(session, stepStartEvent(1));
  now = 10000;
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(100)));
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(100)));
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(100)));

  assert.equal(telemetry.snapshot().tokensPerSecond, 30);
});

test("uses exact usage to calibrate estimated streamed output", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, { type: "turn/start", data: { turn: 1 } });
  telemetry.handle(session, stepStartEvent(1));
  now = 10000;
  telemetry.handle(session, deltaEvent("reasoning-delta", "中".repeat(300)));
  assert.equal(telemetry.snapshot().tokensPerSecond, 30);

  telemetry.handle(session, usageEvent(100, 1));
  assert.equal(telemetry.snapshot().tokensPerSecond, 10);
});

test("treats the first cumulative usage from an attached session as a baseline", () => {
  let now = 0;
  const telemetry = new FleetTelemetry(() => now);
  const session = { id: "session-1" };

  telemetry.handle(session, usageEvent(10957, 1));
  assert.equal(telemetry.snapshot().tokensPerSecond, 0);

  now = 10000;
  telemetry.handle(session, usageEvent(11157, 1));
  assert.equal(telemetry.snapshot().tokensPerSecond, 20);
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

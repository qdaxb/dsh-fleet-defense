import assert from "node:assert/strict";
import test from "node:test";
import { advanceDodgeGame, createDodgeGame } from "./engine.js";

const idleInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  pointer: null,
  item: null,
};

test("token throughput accelerates item charge without changing score rate", () => {
  const slow = safeGame();
  const fast = structuredClone(slow);

  const slowNext = advanceDodgeGame(slow, idleInput, telemetry(1.6, 0), 1);
  const fastNext = advanceDodgeGame(fast, idleInput, telemetry(18, 120), 1);

  assert.equal(slowNext.energy, 1.6);
  assert.equal(fastNext.energy, 18);
  assert.equal(slowNext.score, fastNext.score);
  assert.deepEqual(slowNext.bullets, fastNext.bullets);
});

test("spends charge on three distinct survival items", () => {
  const shielded = advanceDodgeGame(
    { ...safeGame(), energy: 100 },
    { ...idleInput, item: "shield" },
    telemetry(),
    0.01,
  );
  assert.ok(shielded.shieldTimer > 3.9);
  assert.ok(shielded.energy < 56);

  const slowed = advanceDodgeGame(
    { ...safeGame(), energy: 100 },
    { ...idleInput, item: "slow" },
    telemetry(),
    0.01,
  );
  assert.ok(slowed.slowTimer > 4.9);
  assert.ok(slowed.energy < 36);

  const pulsed = advanceDodgeGame(
    {
      ...safeGame(),
      energy: 100,
      bullets: [bulletAt(20, 20), bulletAt(80, 80)],
    },
    { ...idleInput, item: "pulse" },
    telemetry(),
    0.01,
  );
  assert.equal(pulsed.energy, 0);
  assert.equal(pulsed.bullets.length, 0);
});

test("collision costs one life and grants an invulnerability window", () => {
  const game = {
    ...safeGame(),
    bullets: [bulletAt(50, 72), bulletAt(50, 72)],
  };
  const next = advanceDodgeGame(game, idleInput, telemetry(), 0.01);

  assert.equal(next.lives, 2);
  assert.ok(next.invulnerableTimer > 1.6);
});

test("shield prevents collision damage", () => {
  const game = {
    ...safeGame(),
    shieldTimer: 1,
    bullets: [bulletAt(50, 72)],
  };
  const next = advanceDodgeGame(game, idleInput, telemetry(), 0.01);

  assert.equal(next.lives, 3);
});

test("continues running beyond sixty seconds", () => {
  const game = {
    ...safeGame(),
    elapsed: 59.98,
  };
  const next = advanceDodgeGame(game, idleInput, telemetry(), 0.05);

  assert.equal(next.status, "running");
  assert.ok(next.elapsed > 60);
});

test("ends only when the player runs out of lives", () => {
  const game = {
    ...safeGame(),
    lives: 1,
    elapsed: 125,
    bullets: [bulletAt(50, 72)],
  };
  const next = advanceDodgeGame(game, idleInput, telemetry(), 0.01);

  assert.equal(next.status, "ended");
  assert.equal(next.lives, 0);
  assert.ok(next.elapsed > 125);
});

function safeGame() {
  return {
    ...createDodgeGame(true),
    spawnCooldown: 999,
  };
}

function telemetry(charge = 1.6, tokensPerSecond = 0) {
  return {
    activeSessions: tokensPerSecond > 0 ? 1 : 0,
    tokensPerSecond,
    ultimateChargePerSecond: charge,
  };
}

function bulletAt(x, y) {
  return {
    id: crypto.randomUUID(),
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 1,
    kind: "shot",
    grazed: false,
  };
}

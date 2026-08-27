const LIVE_RATE_STALE_MS = 2000;
const USAGE_RATE_STALE_MS = 5000;

export class FleetTelemetry {
  constructor(clock = () => Date.now()) {
    this.clock = clock;
    this.sessions = new Map();
  }

  handle(session, event) {
    const now = this.clock();
    const state = this.sessionState(session.id, now);
    state.lastEventAt = now;

    if (event.type === "turn/start") {
      state.active = true;
      state.startedAt = now;
      state.lastOutputTokens = 0;
      state.lastUsageAt = now;
      state.lastDeltaAt = null;
      state.estimatedOutputTokens = 0;
      state.calibration = 1;
      state.liveRate = 0;
      state.usageRate = 0;
      state.rate = 0;
      return;
    }

    if (
      event.type === "assistant/chunk" &&
      (event.data?.chunk?.type === "text-delta" ||
        event.data?.chunk?.type === "reasoning-delta")
    ) {
      const text = event.data.chunk.text;
      if (typeof text !== "string" || !text) return;
      state.active = true;
      const estimatedTokens = estimateTokens(text);
      const elapsedMs =
        state.lastDeltaAt === null ? 1000 : Math.max(50, now - state.lastDeltaAt);
      const instantaneousRate =
        (estimatedTokens * state.calibration * 1000) / elapsedMs;
      state.liveRate =
        state.liveRate === 0
          ? instantaneousRate
          : state.liveRate * 0.65 + instantaneousRate * 0.35;
      state.estimatedOutputTokens += estimatedTokens;
      state.lastDeltaAt = now;
      return;
    }

    if (
      event.type === "assistant/chunk" &&
      event.data?.chunk?.type === "usage"
    ) {
      const outputTokens = nonNegative(event.data.chunk.usage?.outputTokens);
      if (outputTokens === null) return;
      state.active = true;
      const elapsedMs = Math.max(1, now - state.lastUsageAt);
      const delta = Math.max(0, outputTokens - state.lastOutputTokens);
      const instantaneousRate = (delta * 1000) / elapsedMs;
      state.usageRate =
        state.usageRate === 0
          ? instantaneousRate
          : state.usageRate * 0.65 + instantaneousRate * 0.35;
      if (state.estimatedOutputTokens > 0 && outputTokens > 0) {
        state.calibration = clamp(
          outputTokens / state.estimatedOutputTokens,
          0.25,
          4,
        );
      }
      state.lastOutputTokens = Math.max(state.lastOutputTokens, outputTokens);
      state.lastUsageAt = now;
      return;
    }

    if (event.type === "turn/end") {
      state.active = false;
      state.liveRate = 0;
      state.usageRate = 0;
    }
  }

  snapshot() {
    const now = this.clock();
    const sessions = [...this.sessions.entries()].map(([sessionId, state]) => {
      const liveAge =
        state.lastDeltaAt === null ? Number.POSITIVE_INFINITY : now - state.lastDeltaAt;
      const usageAge = now - state.lastUsageAt;
      const rate =
        liveAge <= LIVE_RATE_STALE_MS
          ? state.liveRate * Math.exp(-liveAge / LIVE_RATE_STALE_MS)
          : usageAge <= USAGE_RATE_STALE_MS
            ? state.usageRate
            : 0;
      return {
        sessionId,
        active: state.active,
        tokensPerSecond: state.active ? round(rate) : 0,
        lastEventAt: state.lastEventAt,
      };
    });
    const activeSessions = sessions.filter((session) => session.active);
    const parallelTasks = activeSessions.length;
    const synergy = round(
      1 + Math.min(4, Math.max(0, parallelTasks - 1)) * 0.12,
      2,
    );
    const tokensPerSecond = round(
      activeSessions.reduce(
        (total, session) => total + session.tokensPerSecond,
        0,
      ),
    );
    return {
      sampledAt: now,
      activeSessions: parallelTasks,
      tokensPerSecond,
      synergy,
      ultimateChargePerSecond: round(4 + tokensPerSecond * 0.18 * synergy),
      sessions,
    };
  }

  sessionState(sessionId, now) {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const state = {
      active: false,
      startedAt: now,
      lastEventAt: now,
      lastUsageAt: now,
      lastDeltaAt: null,
      lastOutputTokens: 0,
      estimatedOutputTokens: 0,
      calibration: 1,
      liveRate: 0,
      usageRate: 0,
    };
    this.sessions.set(sessionId, state);
    return state;
  }
}

function estimateTokens(text) {
  let ascii = 0;
  let nonAscii = 0;
  for (const character of text) {
    if (character.codePointAt(0) <= 0x7f) ascii += 1;
    else nonAscii += 1;
  }
  return ascii / 4 + nonAscii;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function nonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

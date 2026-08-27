const LIVE_RATE_WINDOW_MS = 2000;
const MIN_RATE_WINDOW_MS = 1000;
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
      state.lastUsageAt = now;
      state.lastDeltaAt = null;
      state.stepKey = null;
      state.stepStartedAt = now;
      state.tokenSamples = [];
      state.usageRate = 0;
      return;
    }

    if (event.type === "step/start") {
      state.active = true;
      startStep(state, event.data, now);
      return;
    }

    if (
      event.type === "assistant/chunk" &&
      (event.data?.chunk?.type === "text-delta" ||
        event.data?.chunk?.type === "reasoning-delta" ||
        event.data?.chunk?.type === "tool-call-delta")
    ) {
      startStepIfNeeded(state, event.data, now);
      const text =
        event.data.chunk.type === "tool-call-delta"
          ? event.data.chunk.argumentsDelta
          : event.data.chunk.text;
      if (typeof text !== "string" || !text) return;
      state.active = true;
      const estimatedTokens = estimateTokens(text);
      state.tokenSamples.push({ at: now, tokens: estimatedTokens });
      pruneSamples(state, now);
      state.lastDeltaAt = now;
      return;
    }

    if (
      event.type === "assistant/chunk" &&
      event.data?.chunk?.type === "usage"
    ) {
      const outputTokens = nonNegative(event.data.chunk.usage?.outputTokens);
      if (outputTokens === null) return;
      startStepIfNeeded(state, event.data, now);
      state.active = true;
      const elapsedMs = Math.max(
        MIN_RATE_WINDOW_MS,
        now - state.stepStartedAt,
      );
      state.usageRate = (outputTokens * 1000) / elapsedMs;
      state.lastUsageAt = now;
      return;
    }

    if (event.type === "turn/end") {
      state.active = false;
      state.tokenSamples = [];
      state.usageRate = 0;
    }
  }

  snapshot() {
    const now = this.clock();
    const sessions = [...this.sessions.entries()].map(([sessionId, state]) => {
      pruneSamples(state, now);
      const liveAge =
        state.lastDeltaAt === null ? Number.POSITIVE_INFINITY : now - state.lastDeltaAt;
      const usageAge = now - state.lastUsageAt;
      const rate =
        liveAge <= LIVE_RATE_WINDOW_MS
          ? rollingRate(state, now) *
            Math.exp(-liveAge / LIVE_RATE_WINDOW_MS)
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
      stepKey: null,
      stepStartedAt: now,
      tokenSamples: [],
      usageRate: 0,
    };
    this.sessions.set(sessionId, state);
    return state;
  }
}

function startStepIfNeeded(state, data, now) {
  const key = stepKey(data);
  if (state.stepKey !== key) startStep(state, data, now);
}

function startStep(state, data, now) {
  state.stepKey = stepKey(data);
  state.stepStartedAt = now;
}

function stepKey(data) {
  return `${data?.turn ?? "unknown"}:${data?.step ?? "unknown"}`;
}

function pruneSamples(state, now) {
  const cutoff = now - LIVE_RATE_WINDOW_MS;
  while (state.tokenSamples[0]?.at < cutoff) state.tokenSamples.shift();
}

function rollingRate(state, now) {
  const tokens = state.tokenSamples.reduce(
    (total, sample) => total + sample.tokens,
    0,
  );
  const elapsedMs = Math.max(
    MIN_RATE_WINDOW_MS,
    Math.min(LIVE_RATE_WINDOW_MS, now - state.startedAt),
  );
  return (tokens * 1000) / elapsedMs;
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

function nonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

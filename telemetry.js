const RATE_DECAY_MS = 3000;

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
      state.rate = 0;
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
      state.rate =
        state.rate === 0
          ? instantaneousRate
          : state.rate * 0.65 + instantaneousRate * 0.35;
      state.lastOutputTokens = Math.max(state.lastOutputTokens, outputTokens);
      state.lastUsageAt = now;
      return;
    }

    if (event.type === "turn/end") {
      state.active = false;
      state.rate = 0;
    }
  }

  snapshot() {
    const now = this.clock();
    const sessions = [...this.sessions.entries()].map(([sessionId, state]) => {
      const ageMs = Math.max(0, now - state.lastUsageAt);
      const rate = state.active
        ? state.rate * Math.exp(-ageMs / RATE_DECAY_MS)
        : 0;
      return {
        sessionId,
        active: state.active,
        tokensPerSecond: round(rate),
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
      lastOutputTokens: 0,
      rate: 0,
    };
    this.sessions.set(sessionId, state);
    return state;
  }
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

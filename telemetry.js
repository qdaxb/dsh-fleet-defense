const MIN_RATE_WINDOW_MS = 1000;

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
      state.turnStartedAt = now;
      state.stepKey = null;
      state.stepStartedAt = now;
      state.stepStartObserved = true;
      state.observedOutputTokens = 0;
      state.lastUsageTokens = null;
      state.lastUsageAt = null;
      state.currentRate = 0;
      return;
    }

    if (event.type === "step/start") {
      state.active = true;
      startStep(state, event.data, now, true);
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
      state.observedOutputTokens += estimatedTokens;
      state.currentRate = averageRate(
        state.observedOutputTokens,
        state.stepStartedAt,
        now,
      );
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
      if (
        state.lastUsageTokens !== null &&
        state.lastUsageAt !== null &&
        outputTokens >= state.lastUsageTokens
      ) {
        state.currentRate = averageRate(
          outputTokens - state.lastUsageTokens,
          state.lastUsageAt,
          now,
        );
      } else if (state.stepStartObserved) {
        state.currentRate = averageRate(
          outputTokens,
          state.stepStartedAt,
          now,
        );
      }
      if (state.stepStartObserved) {
        state.observedOutputTokens = outputTokens;
      }
      state.lastUsageTokens = outputTokens;
      state.lastUsageAt = now;
      return;
    }

    if (event.type === "turn/end") {
      state.active = false;
      state.observedOutputTokens = 0;
      state.currentRate = 0;
    }
  }

  snapshot() {
    const now = this.clock();
    const sessions = [...this.sessions.entries()].map(([sessionId, state]) => {
      return {
        sessionId,
        active: state.active,
        tokensPerSecond: state.active ? round(state.currentRate) : 0,
        lastEventAt: state.lastEventAt,
      };
    });
    const activeSessions = sessions.filter((session) => session.active);
    const parallelTasks = activeSessions.length;
    const synergy = round(
      1 + Math.min(4, Math.max(0, parallelTasks - 1)) * 0.16,
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
      ultimateChargePerSecond: round(
        1.6 +
          Math.min(5, parallelTasks) * 0.7 +
          tokensPerSecond * 0.12 * synergy,
      ),
      sessions,
    };
  }

  sessionState(sessionId, now) {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const state = {
      active: false,
      startedAt: now,
      turnStartedAt: null,
      lastEventAt: now,
      stepKey: null,
      stepStartedAt: now,
      stepStartObserved: false,
      observedOutputTokens: 0,
      lastUsageTokens: null,
      lastUsageAt: null,
      currentRate: 0,
    };
    this.sessions.set(sessionId, state);
    return state;
  }
}

function startStepIfNeeded(state, data, now) {
  const key = stepKey(data);
  if (state.stepKey === key) return;
  const observedStart = state.turnStartedAt !== null;
  startStep(
    state,
    data,
    observedStart ? state.turnStartedAt : now,
    observedStart,
  );
}

function startStep(state, data, now, observed) {
  state.stepKey = stepKey(data);
  state.stepStartedAt = now;
  state.stepStartObserved = observed;
  state.observedOutputTokens = 0;
  state.lastUsageTokens = null;
  state.lastUsageAt = null;
  state.currentRate = 0;
}

function stepKey(data) {
  return `${data?.turn ?? "unknown"}:${data?.step ?? "unknown"}`;
}

function averageRate(tokens, startedAt, now) {
  const elapsedMs = Math.max(MIN_RATE_WINDOW_MS, now - startedAt);
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

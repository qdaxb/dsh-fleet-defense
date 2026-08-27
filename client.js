window.__ModuleLoader__.load({
  id: "@wegent/ai-fleet-defense",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { createElement, useCallback, useEffect, useMemo, useRef, useState } =
      React;
    const PACKAGE_NAME = "@wegent/ai-fleet-defense";
    const UNIT = "ai_fleet_defense";
    const DESCRIPTOR = { version: 1, tables: ["scores"], has_global: false };
    const STATE_PATH = "/ai-fleet-defense/v1/state";
    const GAME_SECONDS = 180;

    function FleetDefenseRoute() {
      const [telemetry, setTelemetry] = useState(emptyTelemetry);
      const [game, setGame] = useState(createGame);
      const [leaderboard, setLeaderboard] = useState([]);
      const [storageError, setStorageError] = useState("");
      const telemetryRef = useRef(telemetry);
      const inputRef = useRef({ lane: 1, ultimate: false });
      const submittedScoreRef = useRef(null);
      telemetryRef.current = telemetry;

      const refreshLeaderboard = useCallback(async () => {
        try {
          const response = await storageFetch(
            `/units/${UNIT}/tables/scores/shared?package=${encodeURIComponent(PACKAGE_NAME)}`,
          );
          const body = await response.json();
          const rows = Array.isArray(body.records) ? body.records : [];
          rows.sort(
            (left, right) =>
              Number(right.value?.score ?? 0) - Number(left.value?.score ?? 0),
          );
          setLeaderboard(rows.slice(0, 100));
          setStorageError("");
        } catch (error) {
          setStorageError(
            error instanceof Error ? error.message : String(error),
          );
        }
      }, []);

      useEffect(() => {
        let active = true;
        const poll = async () => {
          try {
            const response = await fetch(STATE_PATH, { cache: "no-store" });
            if (!response.ok)
              throw new Error(`Telemetry HTTP ${response.status}`);
            const body = await response.json();
            if (active) setTelemetry(body);
          } catch {
            if (active) setTelemetry(emptyTelemetry);
          }
        };
        poll();
        const timer = setInterval(poll, 500);
        return () => {
          active = false;
          clearInterval(timer);
        };
      }, []);

      useEffect(() => {
        refreshLeaderboard();
      }, [refreshLeaderboard]);

      useEffect(() => {
        const onKey = (event) => {
          if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
            inputRef.current.lane = Math.max(0, inputRef.current.lane - 1);
          }
          if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
            inputRef.current.lane = Math.min(2, inputRef.current.lane + 1);
          }
          if (event.key === " ") {
            event.preventDefault();
            inputRef.current.ultimate = true;
          }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, []);

      useEffect(() => {
        let frame = 0;
        let previous = performance.now();
        const tick = (now) => {
          const dt = Math.min(0.05, (now - previous) / 1000);
          previous = now;
          setGame((current) =>
            advanceGame(current, inputRef.current, telemetryRef.current, dt),
          );
          inputRef.current.ultimate = false;
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      }, []);

      useEffect(() => {
        if (game.status !== "ended" || submittedScoreRef.current === game.runId)
          return;
        submittedScoreRef.current = game.runId;
        submitScore(game)
          .then(refreshLeaderboard)
          .catch((error) =>
            setStorageError(
              error instanceof Error ? error.message : String(error),
            ),
          );
      }, [game, refreshLeaderboard]);

      const rank = useMemo(() => {
        const index = leaderboard.findIndex(
          (row) => Number(row.value?.score) <= game.score,
        );
        return index < 0 ? leaderboard.length + 1 : index + 1;
      }, [game.score, leaderboard]);

      return createElement(
        "main",
        { style: styles.page, "data-testid": "ai-fleet-defense-page" },
        createElement(
          "header",
          { style: styles.header },
          createElement(
            "div",
            null,
            createElement("h1", { style: styles.title }, "AI 舰队防线"),
          ),
          createElement(
            "div",
            { style: styles.telemetry },
            createMetric("并行任务", telemetry.activeSessions),
            createMetric("Token / s", formatNumber(telemetry.tokensPerSecond)),
            createMetric("协同倍率", `×${telemetry.synergy}`),
          ),
        ),
        createElement(
          "section",
          { style: styles.content },
          createElement(
            "div",
            { style: styles.gamePanel },
            createElement(
              "div",
              { style: styles.hud },
              createElement("span", null, `得分 ${formatNumber(game.score)}`),
              createElement(
                "span",
                null,
                `护盾 ${Math.max(0, Math.round(game.hp))}%`,
              ),
              createElement(
                "span",
                null,
                `剩余 ${Math.ceil(Math.max(0, GAME_SECONDS - game.elapsed))}s`,
              ),
              createElement("span", null, `预计排名 #${rank}`),
            ),
            createElement(
              "div",
              {
                style: styles.battlefield,
                "data-testid": "ai-fleet-defense-battlefield",
              },
              [0, 1, 2].map((lane) =>
                createElement(
                  "div",
                  {
                    key: lane,
                    style: {
                      ...styles.lane,
                      borderColor:
                        lane === game.playerLane ? "#d97706" : "#d4d4d4",
                    },
                    onClick: () => {
                      inputRef.current.lane = lane;
                    },
                  },
                  createElement(
                    "div",
                    { style: styles.ship },
                    lane === game.playerLane
                      ? "◆"
                      : telemetry.activeSessions > lane
                        ? "◇"
                        : "·",
                  ),
                  game.enemies
                    .filter((enemy) => enemy.lane === lane)
                    .map((enemy) =>
                      createElement(
                        "div",
                        {
                          key: enemy.id,
                          style: {
                            ...styles.enemy,
                            left: `${Math.max(14, enemy.x)}%`,
                            opacity: Math.max(0.35, enemy.hp / enemy.maxHp),
                          },
                        },
                        enemy.boss ? "⬢" : "●",
                      ),
                    ),
                ),
              ),
              game.status !== "running"
                ? createElement(
                    "div",
                    { style: styles.overlay },
                    createElement(
                      "strong",
                      { style: styles.overlayTitle },
                      game.status === "ended" ? "本轮结束" : "让 AI 为舰队供能",
                    ),
                    createElement(
                      "p",
                      { style: styles.overlayText },
                      game.status === "ended"
                        ? `最终得分 ${formatNumber(game.score)}`
                        : "每个正在运行的 DSH Session 都会成为僚机；token 速度越快，射速和大招充能越快。",
                    ),
                    createElement(
                      "button",
                      {
                        type: "button",
                        style: styles.primaryButton,
                        "data-testid": "ai-fleet-defense-start",
                        onClick: () => {
                          submittedScoreRef.current = null;
                          setGame(createGame(true));
                        },
                      },
                      game.status === "ended" ? "再来一局" : "开始防守",
                    ),
                  )
                : null,
            ),
            createElement(
              "div",
              { style: styles.controls },
              createElement(
                "div",
                { style: styles.chargeTrack },
                createElement("div", {
                  style: {
                    ...styles.chargeFill,
                    width: `${Math.min(100, game.ultimate)}%`,
                  },
                }),
              ),
              createElement(
                "button",
                {
                  type: "button",
                  style: {
                    ...styles.ultimateButton,
                    opacity: game.ultimate >= 100 ? 1 : 0.55,
                  },
                  disabled: game.ultimate < 100,
                  "data-testid": "ai-fleet-defense-ultimate",
                  onClick: () => {
                    inputRef.current.ultimate = true;
                  },
                },
                `全舰齐射 ${Math.floor(game.ultimate)}%`,
              ),
              createElement(
                "span",
                { style: styles.help },
                "W/S 或 ↑/↓ 换航道，空格释放大招",
              ),
            ),
          ),
          createElement(
            "aside",
            { style: styles.sidebar },
            createElement(
              "h2",
              { style: styles.sectionTitle },
              "Backend 排行榜",
            ),
            storageError
              ? createElement("p", { style: styles.error }, storageError)
              : leaderboard.length
                ? leaderboard.slice(0, 10).map((row, index) =>
                    createElement(
                      "div",
                      {
                        key: `${row.owner_id}:${row.key}`,
                        style: styles.rankRow,
                      },
                      createElement(
                        "span",
                        { style: styles.rank },
                        `#${index + 1}`,
                      ),
                      createElement(
                        "span",
                        { style: styles.player },
                        row.owner_name,
                      ),
                      createElement(
                        "span",
                        { style: styles.rankScore },
                        formatNumber(row.value?.score ?? 0),
                      ),
                    ),
                  )
                : createElement(
                    "p",
                    { style: styles.muted },
                    "还没有共享战绩。完成一局成为首位舰长。",
                  ),
            createElement(
              "h2",
              { style: { ...styles.sectionTitle, marginTop: 24 } },
              "火力规则",
            ),
            createElement(
              "ul",
              { style: styles.rules },
              createElement("li", null, "每个活跃 Session 提供一架僚机"),
              createElement("li", null, "实时 token/s 提升自动射击频率"),
              createElement("li", null, "2–5 个并行任务获得递减协同加成"),
              createElement(
                "li",
                null,
                "分数来自击杀、生存、连击和 Boss，不直接按 token 计分",
              ),
            ),
          ),
        ),
      );
    }

    function createMetric(label, value) {
      return createElement(
        "div",
        { style: styles.metric },
        createElement("span", { style: styles.metricLabel }, label),
        createElement("strong", null, value),
      );
    }

    function createGame(running = false) {
      return {
        runId: crypto.randomUUID(),
        status: running ? "running" : "idle",
        elapsed: 0,
        playerLane: 1,
        hp: 100,
        ultimate: 0,
        score: 0,
        combo: 0,
        shotCooldown: 0,
        spawnCooldown: 0.6,
        bossSpawned: false,
        nextEnemyId: 1,
        enemies: [],
      };
    }

    function advanceGame(game, input, telemetry, dt) {
      if (game.status !== "running") return { ...game, playerLane: input.lane };
      const next = {
        ...game,
        enemies: game.enemies.map((enemy) => ({ ...enemy })),
        elapsed: game.elapsed + dt,
        playerLane: input.lane,
        shotCooldown: game.shotCooldown - dt,
        spawnCooldown: game.spawnCooldown - dt,
        ultimate: Math.min(
          100,
          game.ultimate + dt * Number(telemetry.ultimateChargePerSecond ?? 4),
        ),
      };
      const tps = Math.max(0, Number(telemetry.tokensPerSecond ?? 0));
      const active = Math.max(0, Number(telemetry.activeSessions ?? 0));
      const synergy = Math.max(1, Number(telemetry.synergy ?? 1));
      const fireInterval = Math.max(0.11, 0.68 - Math.log1p(tps) * 0.095);
      const damage = 10 + Math.sqrt(tps) * 2.2 + Math.min(5, active) * 2;

      while (next.shotCooldown <= 0) {
        next.shotCooldown += fireInterval;
        const target = next.enemies
          .filter((enemy) => enemy.lane === next.playerLane)
          .sort((left, right) => left.x - right.x)[0];
        if (target) target.hp -= damage * synergy;
      }

      if (input.ultimate && next.ultimate >= 100) {
        next.ultimate = 0;
        for (const enemy of next.enemies) enemy.hp -= 180 + tps * 0.8;
      }

      if (next.spawnCooldown <= 0) {
        const boss = !next.bossSpawned && next.elapsed >= 120;
        next.bossSpawned ||= boss;
        const maxHp = boss ? 900 : 36 + next.elapsed * 0.45;
        next.enemies.push({
          id: next.nextEnemyId++,
          lane: boss ? 1 : Math.floor(Math.random() * 3),
          x: 94,
          hp: maxHp,
          maxHp,
          boss,
        });
        next.spawnCooldown = boss
          ? 4
          : Math.max(0.42, 1.25 - next.elapsed / 220);
      }

      for (const enemy of next.enemies)
        enemy.x -= dt * (enemy.boss ? 4 : 7 + next.elapsed / 70);
      const destroyed = next.enemies.filter((enemy) => enemy.hp <= 0);
      if (destroyed.length) {
        next.combo += destroyed.length;
        next.score += destroyed.reduce(
          (total, enemy) =>
            total + (enemy.boss ? 5000 : 100 + Math.min(500, next.combo * 8)),
          0,
        );
      }
      const breached = next.enemies.filter(
        (enemy) => enemy.hp > 0 && enemy.x <= 12,
      );
      if (breached.length) {
        next.hp -= breached.reduce(
          (total, enemy) => total + (enemy.boss ? 45 : 12),
          0,
        );
        next.combo = 0;
      }
      next.enemies = next.enemies.filter(
        (enemy) => enemy.hp > 0 && enemy.x > 12,
      );
      next.score += dt * 10;

      if (next.hp <= 0 || next.elapsed >= GAME_SECONDS) {
        next.status = "ended";
        next.score = Math.max(
          0,
          Math.round(next.score + Math.max(0, next.hp) * 20),
        );
      }
      return next;
    }

    async function submitScore(game) {
      if (!backendConnection() || game.score <= 0) return;
      const currentResponse = await storageFetch(
        `/units/${UNIT}/load?package=${encodeURIComponent(PACKAGE_NAME)}`,
        {
          method: "POST",
          body: JSON.stringify(DESCRIPTOR),
        },
      );
      const current = await currentResponse.json();
      const bestScore = Number(current.tables?.scores?.best?.score ?? 0);
      if (bestScore >= game.score) return;

      const response = await storageFetch(
        `/units/${UNIT}/tables/scores/records/best?package=${encodeURIComponent(PACKAGE_NAME)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...DESCRIPTOR,
            value: {
              score: game.score,
              survivedSeconds: Math.round(game.elapsed),
              remainingHp: Math.max(0, Math.round(game.hp)),
              playedAt: new Date().toISOString(),
            },
            shared: true,
          }),
        },
      );
      if (!response.ok)
        throw new Error(`保存战绩失败：HTTP ${response.status}`);
    }

    async function storageFetch(path, options = {}) {
      const connection = backendConnection();
      if (!connection)
        throw new Error("连接 Wegent Backend 后才能共享和查看排行榜");
      const response = await fetch(
        `${connection.apiBaseUrl}/v1/dsh-plugin-storage${path}`,
        {
          ...options,
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${connection.token}`,
            ...(options.headers ?? {}),
          },
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new Error(`排行榜请求失败：HTTP ${response.status}`);
      return response;
    }

    function backendConnection() {
      try {
        const stored = JSON.parse(
          localStorage.getItem("wework.cloudConnection") ?? "null",
        );
        if (
          stored &&
          typeof stored.apiBaseUrl === "string" &&
          stored.apiBaseUrl &&
          typeof stored.token === "string" &&
          stored.token
        ) {
          return {
            apiBaseUrl: stored.apiBaseUrl.replace(/\/+$/, ""),
            token: stored.token,
          };
        }
      } catch {}

      const token = localStorage.getItem("auth_token");
      if (!token) return null;
      return {
        apiBaseUrl: (
          window.__WEWORK_RUNTIME_CONFIG__?.apiBaseUrl ?? "/wework/api"
        ).replace(/\/+$/, ""),
        token,
      };
    }

    function formatNumber(value) {
      return Math.round(Number(value) || 0).toLocaleString();
    }

    const emptyTelemetry = {
      activeSessions: 0,
      tokensPerSecond: 0,
      synergy: 1,
      ultimateChargePerSecond: 4,
      sessions: [],
    };

    const styles = {
      page: {
        background: "#f5f5f4",
        color: "#171717",
        minHeight: "100%",
        padding: 20,
        boxSizing: "border-box",
      },
      header: {
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        gap: 20,
        marginBottom: 16,
      },
      title: { fontSize: 24, fontWeight: 600, margin: 0 },
      telemetry: { display: "flex", gap: 8 },
      metric: {
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        display: "grid",
        gap: 2,
        minWidth: 96,
        padding: "8px 12px",
      },
      metricLabel: { color: "#737373", fontSize: 12 },
      content: {
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        gap: 16,
      },
      gamePanel: {
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: 16,
      },
      hud: {
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      },
      battlefield: {
        background: "#171717",
        borderRadius: 12,
        minHeight: 390,
        overflow: "hidden",
        position: "relative",
      },
      lane: {
        alignItems: "center",
        borderBottom: "1px solid",
        boxSizing: "border-box",
        color: "#f5f5f5",
        display: "flex",
        height: 130,
        position: "relative",
      },
      ship: {
        color: "#f59e0b",
        fontSize: 32,
        left: "5%",
        position: "absolute",
      },
      enemy: {
        color: "#f5f5f5",
        fontSize: 24,
        position: "absolute",
        transform: "translateX(-50%)",
      },
      overlay: {
        alignItems: "center",
        background: "rgba(23,23,23,.82)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        inset: 0,
        justifyContent: "center",
        padding: 40,
        position: "absolute",
        textAlign: "center",
      },
      overlayTitle: { fontSize: 28 },
      overlayText: { color: "#d4d4d4", lineHeight: 1.6, maxWidth: 520 },
      primaryButton: {
        background: "#fff",
        border: 0,
        borderRadius: 8,
        color: "#171717",
        cursor: "pointer",
        padding: "10px 18px",
      },
      controls: {
        alignItems: "center",
        display: "flex",
        gap: 12,
        marginTop: 12,
      },
      chargeTrack: {
        background: "#e5e5e5",
        borderRadius: 999,
        flex: 1,
        height: 8,
        overflow: "hidden",
      },
      chargeFill: {
        background: "#d97706",
        height: "100%",
        transition: "width .2s linear",
      },
      ultimateButton: {
        background: "#171717",
        border: 0,
        borderRadius: 8,
        color: "#fff",
        padding: "8px 12px",
      },
      help: { color: "#737373", fontSize: 12 },
      sidebar: {
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: 16,
      },
      sectionTitle: { fontSize: 16, fontWeight: 600, margin: "0 0 12px" },
      rankRow: {
        alignItems: "center",
        display: "grid",
        gridTemplateColumns: "36px 1fr auto",
        padding: "7px 0",
      },
      rank: { color: "#737373" },
      player: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      },
      rankScore: { fontVariantNumeric: "tabular-nums", fontWeight: 600 },
      muted: { color: "#737373", lineHeight: 1.5 },
      error: { color: "#b91c1c", lineHeight: 1.5 },
      rules: { color: "#525252", lineHeight: 1.7, margin: 0, paddingLeft: 20 },
    };

    exports.inject = ["slots", "wework"];
    exports.apply = (ctx) => {
      ctx.slots.inject("wework.route", () =>
        ctx.wework.ui.register(
          ctx,
          "wework.route",
          {
            id: "ai-fleet-defense.route",
            icon: "applications",
            path: "/ai-fleet-defense",
            restorePolicy: "session",
            title: "AI 舰队防线",
          },
          FleetDefenseRoute,
        ),
      );
      ctx.slots.inject("wework.sidebar.navigation", () =>
        ctx.wework.ui.register(ctx, "wework.sidebar.navigation", {
          id: "ai-fleet-defense.navigation",
          activeItem: "ai-fleet-defense",
          icon: "applications",
          label: "AI 舰队防线",
          order: 35,
          path: "/ai-fleet-defense",
          testId: "ai-fleet-defense-button",
        }),
      );
    };
    return module.exports;
  },
});

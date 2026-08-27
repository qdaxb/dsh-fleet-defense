window.__ModuleLoader__.load({
  id: "@wegent/ai-fleet-defense",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { createElement: h, useCallback, useEffect, useMemo, useRef, useState } =
      React;
    const PACKAGE_NAME = "@wegent/ai-fleet-defense";
    const UNIT = "ai_fleet_defense";
    const DESCRIPTOR = { version: 1, tables: ["scores"], has_global: false };
    const STATE_PATH = "/ai-fleet-defense/v1/state";
    const BACKGROUND_PATH =
      "/ai-fleet-defense/assets/neural-rift-battlefield.png";
    const GAME_SECONDS = 180;
    const BOSS_SECONDS = 120;

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
          if (event.key === "ArrowUp" || event.key.toLowerCase() === "w")
            inputRef.current.lane = Math.max(0, inputRef.current.lane - 1);
          if (event.key === "ArrowDown" || event.key.toLowerCase() === "s")
            inputRef.current.lane = Math.min(2, inputRef.current.lane + 1);
          if (event.key === " ") {
            event.preventDefault();
            inputRef.current.ultimate = true;
          }
          if (event.key === "Escape") returnToWorkbench();
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
      const activeSessions = telemetry.sessions
        .filter((session) => session.active)
        .sort((left, right) => right.tokensPerSecond - left.tokensPerSecond);
      const firepower = firepowerLevel(telemetry);

      return h(
        "main",
        { className: "afd-page", "data-testid": "ai-fleet-defense-page" },
        h("style", null, gameCss),
        h(
          "header",
          { className: "afd-header" },
          h(
            "div",
            { className: "afd-brand" },
            h(
              "div",
              { className: "afd-brand-mark" },
              h("span", { className: "afd-brand-core" }),
              h("span", { className: "afd-brand-orbit" }),
            ),
            h(
              "div",
              null,
              h("div", { className: "afd-eyebrow" }, "WEWORK PARALLEL OPS // LIVE"),
              h("h1", null, "AI 舰队 · 零号防线"),
              h("p", null, "旗舰可独立作战；正在工作的 AI 会跃迁成为增援"),
            ),
          ),
          h(
            "div",
            { className: "afd-metrics" },
            metric(
              "并行作战单元",
              telemetry.activeSessions,
              "每个任务 = 1 架僚机",
              "#4de8ff",
            ),
            metric(
              "实时神经火力",
              `${formatNumber(telemetry.tokensPerSecond)} t/s`,
              firepower.label,
              firepower.color,
            ),
            metric(
              "舰队协同",
              `×${telemetry.synergy}`,
              synergyHint(telemetry.activeSessions),
              "#b59cff",
            ),
          ),
          h(
            "button",
            {
              type: "button",
              className: "afd-exit",
              "data-testid": "ai-fleet-defense-exit",
              onClick: returnToWorkbench,
            },
            "← 返回工作台",
          ),
        ),
        h(
          "section",
          { className: "afd-layout" },
          h(
            "div",
            { className: "afd-main-column" },
            h(
              "section",
              { className: "afd-game-shell" },
              h(
                "div",
                { className: "afd-hud" },
                hud("SCORE", formatNumber(game.score)),
                hud("COMBO", game.combo ? `×${game.combo}` : "—", game.combo >= 5),
                hud(
                  "CORE SHIELD",
                  `${Math.max(0, Math.round(game.hp))}%`,
                  game.hp <= 35,
                ),
                hud(
                  game.elapsed < BOSS_SECONDS ? "BOSS SIGNAL" : "BOSS PHASE",
                  game.elapsed < BOSS_SECONDS
                    ? `T-${Math.ceil(BOSS_SECONDS - game.elapsed)}s`
                    : game.bossDefeated
                      ? "CLEARED"
                      : "ACTIVE",
                  game.elapsed >= BOSS_SECONDS,
                ),
                hud(
                  "MISSION TIME",
                  `${Math.ceil(Math.max(0, GAME_SECONDS - game.elapsed))}s`,
                ),
                hud("LIVE RANK", `#${rank}`),
              ),
              h(
                "div",
                {
                  className: "afd-battlefield",
                  style: {
                    backgroundImage: [
                      "linear-gradient(90deg,rgba(2,8,20,.32),rgba(2,8,20,.04) 55%,rgba(24,2,13,.3))",
                      `url(${BACKGROUND_PATH})`,
                    ].join(","),
                  },
                  "data-testid": "ai-fleet-defense-battlefield",
                },
                h("div", { className: "afd-scanlines" }),
                h("div", { className: "afd-vignette" }),
                h(
                  "div",
                  { className: "afd-mission-badge" },
                  h("i", null),
                  game.status === "running"
                    ? `第 ${game.wave} 波 · 防线交战中`
                    : "零号防线待命",
                ),
                h("div", { className: "afd-enemy-zone" }, "敌军跃迁区"),
                [0, 1, 2].map((lane) =>
                  h(
                    "button",
                    {
                      key: lane,
                      type: "button",
                      className:
                        lane === game.playerLane
                          ? "afd-lane afd-lane-active"
                          : "afd-lane",
                      style: { top: `${lane * 33.333}%` },
                      "aria-label": `切换至${laneName(lane)}`,
                      "data-testid": `ai-fleet-defense-lane-${lane}`,
                      onClick: () => {
                        inputRef.current.lane = lane;
                      },
                    },
                    h("span", null, `${lane + 1} / ${laneName(lane)}`),
                  ),
                ),
                h(
                  "div",
                  {
                    className: "afd-player-formation",
                    style: {
                      top: `${16.667 + game.playerLane * 33.333}%`,
                    },
                  },
                  h(
                    "div",
                    { className: "afd-player-label" },
                    h("b", null, "你"),
                    " / 旗舰",
                  ),
                  h(PlayerShip, {
                    boosted: telemetry.tokensPerSecond > 0,
                  }),
                  [0, 1, 2, 3, 4].map((index) =>
                    index < Math.min(5, telemetry.activeSessions)
                      ? h(Wingman, {
                          index,
                          key: index,
                          rate: activeSessions[index]?.tokensPerSecond ?? 0,
                        })
                      : null,
                  ),
                ),
                game.projectiles.map((projectile) =>
                  h("span", {
                    className: "afd-projectile",
                    key: projectile.id,
                    style: {
                      left: `${projectile.x}%`,
                      top: `${16.667 + projectile.lane * 33.333}%`,
                      width: `${28 + projectile.power * 5}px`,
                    },
                  }),
                ),
                game.enemies.map((enemy) =>
                  h(
                    "div",
                    {
                      className: "afd-enemy-wrap",
                      key: enemy.id,
                      style: {
                        left: `${Math.max(9, enemy.x)}%`,
                        top: `${16.667 + enemy.lane * 33.333}%`,
                      },
                    },
                    h(
                      "div",
                      { className: enemy.boss ? "afd-boss-label" : "afd-enemy-label" },
                      enemy.boss ? "NEMESIS // 母体" : enemyName(enemy.kind),
                    ),
                    h(EnemyShip, { boss: enemy.boss, kind: enemy.kind }),
                    h(
                      "div",
                      {
                        className: "afd-enemy-health",
                        style: { width: enemy.boss ? 122 : 58 },
                      },
                      h("span", {
                        style: {
                          width: `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`,
                        },
                      }),
                    ),
                  ),
                ),
                game.bursts.map((burst) =>
                  h("span", {
                    className:
                      burst.kind === "ultimate"
                        ? "afd-ultimate-burst"
                        : "afd-impact-burst",
                    key: burst.id,
                    style: {
                      left: `${burst.x}%`,
                      top: `${16.667 + burst.lane * 33.333}%`,
                    },
                  }),
                ),
                game.status !== "running"
                  ? h(GameOverlay, {
                      game,
                      telemetry,
                      onStart: () => {
                        submittedScoreRef.current = null;
                        setGame(createGame(true));
                      },
                    })
                  : null,
              ),
              h(
                "div",
                { className: "afd-command-bar" },
                h(
                  "div",
                  { className: "afd-move-buttons" },
                  moveButton("W", "上移", "up", () => {
                    inputRef.current.lane = Math.max(
                      0,
                      inputRef.current.lane - 1,
                    );
                  }),
                  moveButton("S", "下移", "down", () => {
                    inputRef.current.lane = Math.min(
                      2,
                      inputRef.current.lane + 1,
                    );
                  }),
                ),
                h(
                  "div",
                  { className: "afd-charge" },
                  h(
                    "div",
                    { className: "afd-charge-title" },
                    h("span", null, "NEURAL OVERDRIVE // 全舰齐射"),
                    h("b", null, `${Math.floor(game.ultimate)}%`),
                  ),
                  h(
                    "div",
                    { className: "afd-charge-track" },
                    h("span", {
                      style: { width: `${Math.min(100, game.ultimate)}%` },
                    }),
                  ),
                  h(
                    "small",
                    null,
                    telemetry.tokensPerSecond > 0
                      ? `${formatNumber(telemetry.tokensPerSecond)} token/s 正在额外加速充能`
                      : "旗舰反应堆正在基础充能，AI 增援可进一步提速",
                  ),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className:
                      game.ultimate >= 100
                        ? "afd-ultimate afd-ultimate-ready"
                        : "afd-ultimate",
                    disabled: game.ultimate < 100,
                    "data-testid": "ai-fleet-defense-ultimate",
                    onClick: () => {
                      inputRef.current.ultimate = true;
                    },
                  },
                  h("small", null, "SPACE"),
                  h(
                    "b",
                    null,
                    game.ultimate >= 100 ? "释放齐射" : "充能中",
                  ),
                ),
              ),
            ),
            h(
              "section",
              { className: "afd-power-chain" },
              h(
                "div",
                { className: "afd-power-copy" },
                h("span", null, "AI"),
                h(
                  "div",
                  null,
                  h("b", null, "无任务也能战斗，有任务就组成舰队"),
                  h(
                    "small",
                    null,
                    "旗舰始终自动开火；Wework 会把所有执行中 Session 的实时输出转化为僚机、射速、伤害与充能加成",
                  ),
                ),
              ),
              h(
                "div",
                { className: "afd-flow" },
                flow(`${telemetry.activeSessions}`, "AI 增援"),
                h("i", null, "→"),
                flow(`${formatNumber(telemetry.tokensPerSecond)}`, "Token / 秒"),
                h("i", null, "→"),
                flow(`×${telemetry.synergy}`, "舰队火力"),
              ),
            ),
          ),
          h(
            "aside",
            { className: "afd-sidebar" },
            h(
              "section",
              { className: "afd-card" },
              sideTitle(
                "FLEET",
                "AI 僚机编队",
                telemetry.activeSessions ? "ONLINE" : "BASE POWER",
              ),
              activeSessions.length
                ? activeSessions.slice(0, 5).map((session, index) =>
                    h(
                      "div",
                      { className: "afd-session", key: session.sessionId },
                      h("span", null, String(index + 1).padStart(2, "0")),
                      h(
                        "div",
                        null,
                        h(
                          "b",
                          null,
                          `AI 僚机 ${String(index + 1).padStart(2, "0")}`,
                        ),
                        h(
                          "small",
                          null,
                          session.tokensPerSecond > 0 ? "正在输出" : "正在思考",
                        ),
                      ),
                      h(
                        "strong",
                        null,
                        formatNumber(session.tokensPerSecond),
                        h("small", null, " t/s"),
                      ),
                    ),
                  )
                : h(
                    "div",
                    { className: "afd-empty-fleet" },
                    h("span", { className: "afd-reactor" }),
                    h("b", null, "旗舰反应堆已上线"),
                    h("p", null, "基础自动炮与大招充能正常，可独立完成整局。"),
                    h(
                      "small",
                      null,
                      "并行启动 AI 任务后，僚机会自动跃迁增援。",
                    ),
                  ),
              telemetry.activeSessions > 5
                ? h(
                    "div",
                    { className: "afd-more" },
                    `另有 ${telemetry.activeSessions - 5} 个任务提供后备算力`,
                  )
                : null,
            ),
            h(
              "section",
              { className: "afd-card" },
              sideTitle("GLOBAL", "战区排行榜", "LIVE"),
              storageError
                ? h(
                    "div",
                    { className: "afd-backend-note" },
                    h("b", null, "单机战区"),
                    h("small", null, "连接 Backend 后自动共享最佳战绩"),
                  )
                : leaderboard.length
                  ? leaderboard.slice(0, 6).map((row, index) =>
                      h(
                        "div",
                        {
                          className:
                            index === 0 ? "afd-rank afd-rank-first" : "afd-rank",
                          key: `${row.owner_id}:${row.key}`,
                        },
                        h("b", null, String(index + 1).padStart(2, "0")),
                        h("span", null, row.owner_name),
                        h(
                          "strong",
                          null,
                          formatNumber(row.value?.score ?? 0),
                        ),
                      ),
                    )
                  : h(
                      "div",
                      { className: "afd-empty-rank" },
                      h("b", null, "等待首位指挥官"),
                      h("small", null, "完成一局即可留下战绩"),
                    ),
            ),
            h(
              "section",
              { className: "afd-card afd-protocol" },
              sideTitle("PROTOCOL", "作战指令", "180 SEC"),
              protocol("01", "切换航道", "点击战场或按 W / S"),
              protocol("02", "旗舰自动开火", "零任务也拥有完整基础火力"),
              protocol("03", "AI 自动增援", "并行任务提升射速、伤害与充能"),
              protocol("04", "释放全舰齐射", "能量满后按空格清扫全场"),
            ),
          ),
        ),
      );
    }

    function GameOverlay({ game, telemetry, onStart }) {
      const ended = game.status === "ended";
      return h(
        "div",
        { className: "afd-overlay" },
        h(
          "div",
          { className: "afd-overlay-card" },
          h(
            "div",
            { className: "afd-overlay-kicker" },
            ended ? "MISSION REPORT" : "COMMAND BRIEFING",
          ),
          h(
            "h2",
            null,
            ended
              ? game.hp > 0
                ? "零号防线守住了"
                : "防线失守"
              : "旗舰已就位，随时可以出击",
          ),
          ended
            ? h(
                "div",
                { className: "afd-result" },
                h("span", null, "最终战绩"),
                h("strong", null, formatNumber(game.score)),
                h(
                  "small",
                  null,
                  `${game.kills} 击破 · ${Math.round(game.elapsed)} 秒坚守`,
                ),
              )
            : h(
                "div",
                { className: "afd-briefing" },
                briefing("01", "操控旗舰", "点击航道或按 W / S 上下移动"),
                briefing(
                  "02",
                  "自动锁定开火",
                  "旗舰自带基础反应堆，没有 AI 任务也能正常战斗",
                ),
                briefing(
                  "03",
                  "召集 AI 舰队",
                  "执行中任务会成为僚机，实时 Token 输出增强全部火力",
                ),
              ),
          h(
            "div",
            { className: "afd-overlay-actions" },
            h(
              "button",
              {
                type: "button",
                className: "afd-start",
                "data-testid": "ai-fleet-defense-start",
                onClick: onStart,
              },
              h("span", null, ended ? "重新部署" : "启动防线"),
              h("b", null, "→"),
            ),
            h(
              "button",
              {
                type: "button",
                className: "afd-exit afd-exit-overlay",
                "data-testid": "ai-fleet-defense-exit-after",
                onClick: returnToWorkbench,
              },
              "退出至工作台",
            ),
          ),
          !ended
            ? h(
                "div",
                { className: "afd-ready-state" },
                h("i", null),
                telemetry.activeSessions
                  ? `旗舰火力在线，另有 ${telemetry.activeSessions} 个 AI 作战单元已连接`
                  : "旗舰基础火力在线，可立即单舰出击",
              )
            : null,
        ),
      );
    }

    function PlayerShip({ boosted }) {
      return h(
        "div",
        { className: boosted ? "afd-player boosted" : "afd-player" },
        h("span", { className: "afd-engine-trail" }),
        h(
          "svg",
          { viewBox: "0 0 160 100", width: 112, height: 70 },
          h(
            "defs",
            null,
            h(
              "linearGradient",
              { id: "afd-player-hull", x1: "0", x2: "1" },
              h("stop", { offset: "0", stopColor: "#26517b" }),
              h("stop", { offset: ".48", stopColor: "#d9f8ff" }),
              h("stop", { offset: "1", stopColor: "#4de8ff" }),
            ),
          ),
          h("path", {
            d: "M7 50 55 13l44 19 48 18-48 18-44 19Z",
            fill: "url(#afd-player-hull)",
          }),
          h("path", {
            d: "m26 50 39-17 53 17-53 17Z",
            fill: "#071b31",
            stroke: "#7cf4ff",
            strokeWidth: "2",
          }),
          h("path", {
            d: "m60 18 29 32-29 32 55-32Z",
            fill: "#9c8cff",
            opacity: ".82",
          }),
          h("path", { d: "M11 43 0 50l11 7 25-7Z", fill: "#bdfaff" }),
          h("circle", { cx: "86", cy: "50", r: "7", fill: "#fff" }),
        ),
      );
    }

    function Wingman({ index, rate }) {
      const positions = [
        { left: 9, top: -54 },
        { left: 9, top: 52 },
        { left: -23, top: -34 },
        { left: -23, top: 32 },
        { left: -43, top: 0 },
      ];
      return h(
        "div",
        {
          className: "afd-wingman",
          style: { ...positions[index], animationDelay: `${index * -0.35}s` },
          title: `AI 僚机 ${index + 1}：${formatNumber(rate)} token/s`,
        },
        h("span", null),
        h(
          "svg",
          { viewBox: "0 0 64 36", width: 42, height: 24 },
          h("path", {
            d: "M2 18 24 3l36 15-36 15Z",
            fill: "#183a5e",
            stroke: "#74efff",
            strokeWidth: "2",
          }),
          h("path", { d: "m20 9 13 9-13 9 30-9Z", fill: "#a98aff" }),
        ),
      );
    }

    function EnemyShip({ boss, kind }) {
      if (boss)
        return h(
          "svg",
          {
            className: "afd-boss",
            viewBox: "0 0 220 150",
            width: 164,
            height: 112,
          },
          h("path", {
            d: "m211 75-47-62-58 31-53-22L7 75l46 53 53-22 58 31Z",
            fill: "#321225",
            stroke: "#ff6c8c",
            strokeWidth: "3",
          }),
          h("path", {
            d: "m184 75-67-43-47 43 47 43Z",
            fill: "#700e39",
            stroke: "#ff9aae",
            strokeWidth: "2",
          }),
          h("circle", { cx: "112", cy: "75", r: "17", fill: "#ffccdc" }),
          h("circle", { cx: "112", cy: "75", r: "9", fill: "#ff315d" }),
        );
      const heavy = kind === "heavy";
      return h(
        "svg",
        {
          className: "afd-enemy",
          viewBox: "0 0 100 70",
          width: heavy ? 72 : 58,
          height: heavy ? 52 : 42,
        },
        h("path", {
          d: heavy
            ? "M96 35 69 4 37 17 5 35l32 18 32 13Z"
            : "M96 35 66 8 39 20 4 35l35 15 27 12Z",
          fill: heavy ? "#46162b" : "#31162a",
          stroke: heavy ? "#ff829c" : "#ff5d78",
          strokeWidth: heavy ? "3" : "2",
        }),
        h("circle", {
          cx: heavy ? "46" : "51",
          cy: "35",
          r: heavy ? "8" : "6",
          fill: "#ffd0da",
        }),
      );
    }

    function metric(label, value, hint, color) {
      return h(
        "div",
        { className: "afd-metric" },
        h("span", null, label, h("i", { style: { background: color } })),
        h("b", null, value),
        h("small", null, hint),
      );
    }

    function hud(label, value, alert = false) {
      return h(
        "div",
        { className: alert ? "afd-hud-item afd-alert" : "afd-hud-item" },
        h("span", null, label),
        h("b", null, value),
      );
    }

    function moveButton(key, label, direction, onClick) {
      return h(
        "button",
        {
          type: "button",
          className: "afd-move",
          "data-testid": `ai-fleet-defense-move-${direction}`,
          onClick,
        },
        h("b", null, key),
        h("small", null, label),
      );
    }

    function flow(value, label) {
      return h(
        "div",
        null,
        h("b", null, value),
        h("small", null, label),
      );
    }

    function sideTitle(kicker, title, status) {
      return h(
        "div",
        { className: "afd-card-title" },
        h("div", null, h("small", null, kicker), h("h2", null, title)),
        h("span", null, status),
      );
    }

    function protocol(number, title, text) {
      return h(
        "div",
        { className: "afd-protocol-row" },
        h("span", null, number),
        h("div", null, h("b", null, title), h("small", null, text)),
      );
    }

    function briefing(number, title, text) {
      return h(
        "div",
        { className: "afd-briefing-row" },
        h("span", null, number),
        h("div", null, h("b", null, title), h("p", null, text)),
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
        kills: 0,
        wave: 1,
        shotCooldown: 0,
        spawnCooldown: 0.8,
        bossSpawned: false,
        bossDefeated: false,
        nextEnemyId: 1,
        nextEffectId: 1,
        enemies: [],
        projectiles: [],
        bursts: [],
      };
    }

    function advanceGame(game, input, telemetry, dt) {
      if (game.status !== "running") return { ...game, playerLane: input.lane };
      const next = {
        ...game,
        enemies: game.enemies.map((enemy) => ({ ...enemy })),
        projectiles: game.projectiles
          .map((projectile) => ({
            ...projectile,
            x: projectile.x + dt * 112,
            age: projectile.age + dt,
          }))
          .filter((projectile) => projectile.x < 102 && projectile.age < 1),
        bursts: game.bursts
          .map((burst) => ({ ...burst, age: burst.age + dt }))
          .filter((burst) => burst.age < (burst.kind === "ultimate" ? 0.9 : 0.5)),
        elapsed: game.elapsed + dt,
        playerLane: input.lane,
        shotCooldown: game.shotCooldown - dt,
        spawnCooldown: game.spawnCooldown - dt,
        wave: Math.min(9, 1 + Math.floor(game.elapsed / 22)),
        ultimate: Math.min(
          100,
          game.ultimate + dt * Number(telemetry.ultimateChargePerSecond ?? 4),
        ),
      };
      const tps = Math.max(0, Number(telemetry.tokensPerSecond ?? 0));
      const active = Math.max(0, Number(telemetry.activeSessions ?? 0));
      const synergy = Math.max(1, Number(telemetry.synergy ?? 1));

      // The flagship always has a complete baseline weapon. AI work is a bonus.
      const fireInterval = Math.max(0.1, 0.62 - Math.log1p(tps) * 0.085);
      const damage = 16 + Math.sqrt(tps) * 2.25 + Math.min(5, active) * 2.5;
      while (next.shotCooldown <= 0) {
        next.shotCooldown += fireInterval;
        const target = next.enemies
          .filter((enemy) => enemy.lane === next.playerLane)
          .sort((left, right) => left.x - right.x)[0];
        if (target) {
          target.hp -= damage * synergy;
          next.projectiles.push({
            id: `p-${next.nextEffectId++}`,
            lane: next.playerLane,
            x: 13,
            age: 0,
            power: Math.min(4, 1 + tps / 80),
          });
          next.bursts.push({
            id: `i-${next.nextEffectId++}`,
            lane: target.lane,
            x: target.x,
            age: 0,
            kind: "impact",
          });
        }
      }

      if (input.ultimate && next.ultimate >= 100) {
        next.ultimate = 0;
        for (const enemy of next.enemies) {
          enemy.hp -= 230 + tps * 0.85;
          next.bursts.push({
            id: `u-${next.nextEffectId++}`,
            lane: enemy.lane,
            x: enemy.x,
            age: 0,
            kind: "ultimate",
          });
        }
      }

      if (next.spawnCooldown <= 0) {
        const boss = !next.bossSpawned && next.elapsed >= BOSS_SECONDS;
        next.bossSpawned ||= boss;
        const kind =
          boss || Math.random() > Math.min(0.62, next.elapsed / 260)
            ? "heavy"
            : "scout";
        const maxHp = boss
          ? 1150
          : kind === "heavy"
            ? 74 + next.elapsed * 0.65
            : 34 + next.elapsed * 0.42;
        next.enemies.push({
          id: next.nextEnemyId++,
          lane: boss ? 1 : Math.floor(Math.random() * 3),
          x: 95,
          hp: maxHp,
          maxHp,
          boss,
          kind,
        });
        next.spawnCooldown = boss
          ? 4
          : Math.max(0.48, 1.35 - next.elapsed / 205);
      }

      for (const enemy of next.enemies) {
        const speed = enemy.boss
          ? 3.2
          : enemy.kind === "heavy"
            ? 4.8 + next.elapsed / 100
            : 7.2 + next.elapsed / 70;
        enemy.x -= dt * speed;
      }
      const destroyed = next.enemies.filter((enemy) => enemy.hp <= 0);
      if (destroyed.length) {
        next.combo += destroyed.length;
        next.kills += destroyed.length;
        next.bossDefeated ||= destroyed.some((enemy) => enemy.boss);
        next.score += destroyed.reduce(
          (total, enemy) =>
            total +
            (enemy.boss
              ? 6000
              : enemy.kind === "heavy"
                ? 240 + Math.min(640, next.combo * 10)
                : 100 + Math.min(500, next.combo * 8)),
          0,
        );
      }
      const breached = next.enemies.filter(
        (enemy) => enemy.hp > 0 && enemy.x <= 9,
      );
      if (breached.length) {
        next.hp -= breached.reduce(
          (total, enemy) =>
            total + (enemy.boss ? 55 : enemy.kind === "heavy" ? 20 : 11),
          0,
        );
        next.combo = 0;
      }
      next.enemies = next.enemies.filter(
        (enemy) => enemy.hp > 0 && enemy.x > 9,
      );
      next.score += dt * (10 + Math.min(20, next.combo));
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
      await storageFetch(
        `/units/${UNIT}/tables/scores/records/best?package=${encodeURIComponent(PACKAGE_NAME)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...DESCRIPTOR,
            value: {
              score: game.score,
              survivedSeconds: Math.round(game.elapsed),
              remainingHp: Math.max(0, Math.round(game.hp)),
              kills: game.kills,
              playedAt: new Date().toISOString(),
            },
            shared: true,
          }),
        },
      );
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
        )
          return {
            apiBaseUrl: stored.apiBaseUrl.replace(/\/+$/, ""),
            token: stored.token,
          };
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

    function firepowerLevel(telemetry) {
      const tps = Number(telemetry.tokensPerSecond ?? 0);
      if (tps >= 120) return { label: "超临界增援", color: "#ff72b1" };
      if (tps >= 60) return { label: "过载增援", color: "#b59cff" };
      if (tps >= 20) return { label: "高能增援", color: "#4de8ff" };
      if (tps > 0) return { label: "AI 已接入", color: "#58f2c2" };
      return { label: "旗舰基础火力", color: "#8ba1b7" };
    }

    function synergyHint(activeSessions) {
      if (activeSessions >= 5) return "协同上限";
      if (activeSessions >= 2) return `再增 ${5 - activeSessions} 个达上限`;
      if (activeSessions === 1) return "再并行 1 个触发协同";
      return "旗舰可独立作战";
    }

    function enemyName(kind) {
      return kind === "heavy" ? "重装破阵舰" : "深空猎手";
    }

    function laneName(lane) {
      return ["上层轨道", "核心航道", "下层轨道"][lane] ?? "未知航道";
    }

    function workbenchPath() {
      const appBase = window.__WEWORK_RUNTIME_CONFIG__?.appBasePath
        ?.replace(/\/+$/, "");
      return appBase ? `${appBase}/` : "/";
    }

    function returnToWorkbench() {
      const target = workbenchPath();
      if (window.location.pathname === target) return;
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
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

    const gameCss = `
      @keyframes afd-pulse{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
      @keyframes afd-float{0%,100%{transform:translateY(-50%) translateY(-2px)}50%{transform:translateY(-50%) translateY(3px)}}
      @keyframes afd-wing{0%,100%{transform:translateY(-2px)}50%{transform:translateY(3px)}}
      @keyframes afd-enemy{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(2deg)}}
      @keyframes afd-impact{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.5)}}
      @keyframes afd-ultimate{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(6)}}
      @keyframes afd-ready{0%,100%{box-shadow:0 0 20px rgba(77,232,255,.25)}50%{box-shadow:0 0 42px rgba(77,232,255,.72)}}
      .afd-exit{background:rgba(79,111,145,.12);border:1px solid rgba(126,178,219,.28);border-radius:9px;color:#9fd6ec;cursor:pointer;font-size:11px;font-weight:700;min-height:34px;padding:0 13px;transition:.2s}.afd-exit:hover{background:rgba(126,218,244,.16);border-color:rgba(126,218,244,.5);color:#e9fbff}.afd-exit-overlay{align-self:center;margin-top:10px}
      .afd-overlay-actions{align-items:center;display:flex;flex-direction:column}
      .afd-page{background:radial-gradient(circle at 42% 0,#101e38 0,#07101f 36%,#030813 76%);box-sizing:border-box;color:#eef8ff;font-family:Inter,"SF Pro Display","PingFang SC","Microsoft YaHei",sans-serif;min-height:100%;padding:22px 24px 32px}
      .afd-header{align-items:center;display:flex;gap:24px;justify-content:space-between;margin:0 auto 18px;max-width:1760px}
      .afd-brand{align-items:center;display:flex;gap:14px}.afd-brand h1{font-size:26px;letter-spacing:-.5px;line-height:1;margin:0}.afd-brand p{color:#7f9ab2;font-size:12px;margin:7px 0 0}
      .afd-brand-mark{align-items:center;display:flex;height:48px;justify-content:center;position:relative;width:48px}.afd-brand-core{background:#d9fbff;border-radius:50%;box-shadow:0 0 20px #4de8ff;height:12px;position:absolute;width:12px}.afd-brand-orbit{border:1px solid #4de8ff;border-radius:50%;height:36px;position:absolute;transform:rotate(-30deg) scaleY(.45);width:36px}.afd-eyebrow{color:#64dff2;font-size:10px;font-weight:800;letter-spacing:2.4px;margin-bottom:4px}
      .afd-metrics{display:flex;gap:9px}.afd-metric{background:linear-gradient(145deg,rgba(21,39,65,.9),rgba(8,19,35,.88));border:1px solid rgba(117,168,207,.18);border-radius:12px;display:grid;min-width:130px;padding:10px 13px}.afd-metric>span{color:#7690a8;font-size:10px}.afd-metric i{border-radius:50%;float:right;height:5px;margin-top:4px;width:5px}.afd-metric b{font-size:19px;margin-top:3px}.afd-metric small{color:#5f768c;font-size:9px}
      .afd-layout{display:grid;gap:14px;grid-template-columns:minmax(760px,1fr) 320px;margin:0 auto;max-width:1760px}.afd-main-column{display:grid;gap:12px;min-width:0}.afd-game-shell{background:rgba(7,16,30,.86);border:1px solid rgba(102,160,202,.2);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
      .afd-hud{background:linear-gradient(180deg,#0d1b30,#091524);border-bottom:1px solid rgba(112,165,202,.18);display:grid;grid-template-columns:repeat(6,1fr);min-height:62px}.afd-hud-item{border-right:1px solid rgba(112,165,202,.13);display:grid;gap:3px;padding:14px 16px}.afd-hud-item span{color:#668098;font-size:8px;letter-spacing:1px}.afd-hud-item b{font-size:13px}.afd-hud-item.afd-alert b{color:#ff6886}
      .afd-battlefield{background-color:#040b18;background-position:center;background-size:cover;height:560px;overflow:hidden;position:relative}.afd-scanlines{background:repeating-linear-gradient(180deg,transparent 0,transparent 3px,rgba(117,221,255,.025) 4px);inset:0;pointer-events:none;position:absolute;z-index:7}.afd-vignette{background:radial-gradient(ellipse at center,transparent 38%,rgba(1,5,14,.58) 100%);inset:0;pointer-events:none;position:absolute;z-index:6}
      .afd-mission-badge{align-items:center;background:rgba(5,16,31,.65);border:1px solid rgba(92,198,225,.2);border-radius:999px;color:#a6bfd2;display:flex;font-size:10px;gap:7px;left:18px;letter-spacing:1.4px;padding:6px 10px;position:absolute;top:16px;z-index:8}.afd-mission-badge i,.afd-ready-state i{animation:afd-pulse 1.4s infinite;background:#4de8ff;border-radius:50%;box-shadow:0 0 8px #4de8ff;height:6px;width:6px}.afd-enemy-zone{color:rgba(255,112,140,.72);font-size:9px;letter-spacing:2px;position:absolute;right:18px;top:19px;z-index:8}
      .afd-lane{appearance:none;background:transparent;border:0;border-bottom:1px solid rgba(128,167,197,.08);box-sizing:border-box;cursor:pointer;height:33.333%;left:0;padding:0;position:absolute;right:0;transition:.25s;z-index:1}.afd-lane-active{background:linear-gradient(90deg,rgba(77,232,255,.08),transparent 58%);border-color:rgba(77,232,255,.32)}.afd-lane span{color:#678096;font-size:8px;font-weight:800;left:16px;letter-spacing:1.2px;position:absolute;top:12px}.afd-lane-active span{color:#7cf4ff}
      .afd-player-formation{height:1px;left:8%;position:absolute;transition:top .2s cubic-bezier(.2,.8,.2,1);width:1px;z-index:4}.afd-player-label{background:rgba(5,20,35,.8);border:1px solid rgba(77,232,255,.36);border-radius:5px;font-size:8px;left:18px;padding:3px 6px;position:absolute;top:-52px;white-space:nowrap}.afd-player{animation:afd-float 2.2s infinite;filter:drop-shadow(0 0 9px rgba(77,232,255,.4));left:-24px;position:absolute;top:0}.afd-player.boosted{filter:drop-shadow(0 0 15px rgba(77,232,255,.9))}.afd-engine-trail{background:linear-gradient(90deg,transparent,rgba(77,232,255,.8));filter:blur(3px);height:10px;left:-24px;position:absolute;top:30px;width:44px}
      .afd-wingman{animation:afd-wing 1.7s infinite;position:absolute}.afd-wingman>span{background:linear-gradient(90deg,transparent,rgba(132,126,255,.82));filter:blur(2px);height:4px;left:-14px;position:absolute;top:10px;width:24px}.afd-projectile{background:linear-gradient(90deg,transparent,#fff 72%,#4de8ff);border-radius:99px;box-shadow:0 0 14px #4de8ff;height:3px;position:absolute;transform:translateY(-50%);z-index:3}
      .afd-enemy-wrap{align-items:center;display:flex;flex-direction:column;position:absolute;transform:translate(-50%,-50%);transition:left .05s linear;z-index:4}.afd-enemy,.afd-boss{animation:afd-enemy 2s infinite;filter:drop-shadow(0 0 12px rgba(255,49,93,.65))}.afd-enemy-label{color:#ff96a9;font-size:7px;letter-spacing:.8px}.afd-boss-label{background:rgba(74,4,31,.8);border:1px solid rgba(255,93,120,.5);border-radius:4px;color:#ffd4dd;font-size:8px;font-weight:800;letter-spacing:1.1px;padding:3px 7px}.afd-enemy-health{background:rgba(12,3,12,.8);border:1px solid rgba(255,117,145,.35);border-radius:99px;height:4px;overflow:hidden}.afd-enemy-health span{background:linear-gradient(90deg,#ff315d,#ff9aae);box-shadow:0 0 8px #ff315d;display:block;height:100%;transition:width .12s}
      .afd-impact-burst,.afd-ultimate-burst{border-radius:50%;pointer-events:none;position:absolute}.afd-impact-burst{animation:afd-impact .5s ease-out forwards;border:2px solid #74efff;box-shadow:0 0 18px #4de8ff;height:24px;width:24px}.afd-ultimate-burst{animation:afd-ultimate .9s ease-out forwards;background:rgba(181,156,255,.28);border:2px solid #fff;box-shadow:0 0 50px #b59cff;height:40px;width:40px}
      .afd-overlay{align-items:center;backdrop-filter:blur(5px);background:rgba(2,7,17,.48);display:flex;inset:0;justify-content:center;padding:28px;position:absolute;z-index:20}.afd-overlay-card{align-items:center;background:linear-gradient(155deg,rgba(14,32,55,.96),rgba(4,13,27,.96));border:1px solid rgba(100,218,241,.32);border-radius:18px;box-shadow:0 26px 80px rgba(0,0,0,.52);display:flex;flex-direction:column;max-width:650px;padding:32px 38px 28px;text-align:center;width:72%}.afd-overlay-kicker{color:#58e4f7;font-size:9px;font-weight:800;letter-spacing:2.8px}.afd-overlay-card h2{font-size:28px;margin:8px 0 24px}.afd-briefing{display:grid;gap:9px;text-align:left;width:100%}.afd-briefing-row{align-items:center;background:rgba(116,177,219,.06);border:1px solid rgba(116,177,219,.12);border-radius:10px;display:grid;gap:12px;grid-template-columns:34px 1fr;padding:10px 13px}.afd-briefing-row>span{color:#53e6f8;font-size:11px;font-weight:900}.afd-briefing-row p{color:#829caf;font-size:10px;margin:3px 0 0}.afd-start{align-items:center;animation:afd-ready 2s infinite;background:linear-gradient(135deg,#66f1ff,#668dff);border:0;border-radius:9px;color:#03101f;cursor:pointer;display:flex;font-size:14px;font-weight:900;justify-content:space-between;margin-top:20px;padding:12px 16px;width:210px}.afd-ready-state{align-items:center;color:#8fa9be;display:flex;font-size:10px;gap:8px;margin-top:14px}.afd-result{display:grid;gap:5px}.afd-result strong{font-size:38px}
      .afd-command-bar{align-items:center;background:linear-gradient(180deg,#0c192c,#081321);border-top:1px solid rgba(112,165,202,.16);display:grid;gap:18px;grid-template-columns:140px 1fr 150px;min-height:86px;padding:0 16px}.afd-move-buttons{display:flex;gap:7px}.afd-move{background:rgba(130,184,224,.08);border:1px solid rgba(130,184,224,.22);border-radius:7px;color:#e9f8ff;cursor:pointer;display:grid;height:48px;width:52px}.afd-move b{font-size:12px}.afd-move small{color:#6f879a;font-size:8px}.afd-charge{display:grid;gap:6px}.afd-charge-title{color:#83a0b7;display:flex;font-size:9px;justify-content:space-between}.afd-charge-track{background:#030a15;border:1px solid rgba(112,165,202,.18);border-radius:4px;height:12px;overflow:hidden}.afd-charge-track span{background:linear-gradient(90deg,#2571ff,#46eaff 58%,#d3fbff);box-shadow:0 0 18px #4de8ff;display:block;height:100%;transition:width .2s}.afd-charge small{color:#526b82;font-size:9px}.afd-ultimate{background:rgba(79,111,145,.11);border:1px solid rgba(112,165,202,.2);border-radius:9px;color:#60788f;display:grid;min-height:52px}.afd-ultimate-ready{background:linear-gradient(135deg,#7cf4ff,#a283ff);border:0;box-shadow:0 0 24px rgba(103,225,255,.5);color:#06101e;cursor:pointer}
      .afd-power-chain{align-items:center;background:linear-gradient(135deg,rgba(13,29,50,.94),rgba(7,18,33,.94));border:1px solid rgba(102,160,202,.18);border-radius:14px;display:flex;justify-content:space-between;min-height:76px;padding:0 18px}.afd-power-copy{align-items:center;display:flex;gap:12px;max-width:58%}.afd-power-copy>span{align-items:center;background:rgba(77,232,255,.1);border:1px solid rgba(77,232,255,.35);border-radius:50%;color:#72edff;display:flex;font-size:9px;font-weight:900;height:34px;justify-content:center;width:34px}.afd-power-copy div{display:grid;gap:3px}.afd-power-copy small{color:#6d879d}.afd-flow{align-items:center;display:flex;gap:12px}.afd-flow>div{display:grid;text-align:center}.afd-flow b{color:#70e9fa}.afd-flow small{color:#61798e;font-size:8px}.afd-flow i{color:#405a71}
      .afd-sidebar{display:grid;gap:12px;grid-auto-rows:max-content}.afd-card{background:linear-gradient(150deg,rgba(15,32,54,.94),rgba(6,16,30,.94));border:1px solid rgba(102,160,202,.18);border-radius:14px;padding:15px}.afd-card-title{align-items:center;display:flex;justify-content:space-between;margin-bottom:12px}.afd-card-title small{color:#547089;font-size:8px;font-weight:900;letter-spacing:1.7px}.afd-card-title h2{font-size:15px;margin:3px 0 0}.afd-card-title>span{border:1px solid rgba(88,242,194,.25);border-radius:99px;color:#58f2c2;font-size:8px;font-weight:900;padding:4px 7px}
      .afd-session{align-items:center;border-top:1px solid rgba(109,158,195,.11);display:grid;gap:9px;grid-template-columns:32px 1fr auto;min-height:49px}.afd-session>span{align-items:center;background:rgba(77,232,255,.08);border:1px solid rgba(77,232,255,.22);border-radius:6px;color:#65e8fb;display:flex;font-size:9px;font-weight:900;height:26px;justify-content:center;width:26px}.afd-session div{display:grid}.afd-session small{color:#60798f;font-size:8px}.afd-empty-fleet,.afd-empty-rank{align-items:center;color:#7290a8;display:flex;flex-direction:column;padding:18px 8px 10px;text-align:center}.afd-empty-fleet p{font-size:10px;margin:7px 0}.afd-reactor{border:1px solid rgba(77,232,255,.35);border-radius:50%;box-shadow:inset 0 0 18px rgba(77,232,255,.14),0 0 18px rgba(77,232,255,.1);height:48px;margin-bottom:11px;width:48px}.afd-more{color:#607b91;font-size:9px;text-align:center}
      .afd-backend-note{background:rgba(255,209,102,.06);border:1px solid rgba(255,209,102,.17);border-radius:8px;display:grid;gap:5px;padding:12px}.afd-rank{align-items:center;border-top:1px solid rgba(109,158,195,.11);display:grid;gap:7px;grid-template-columns:30px 1fr auto;min-height:40px}.afd-rank-first{background:linear-gradient(90deg,rgba(255,209,102,.07),transparent)}.afd-rank>span{color:#c1d3e1;font-size:11px;overflow:hidden;text-overflow:ellipsis}.afd-rank strong{font-size:12px}.afd-protocol{background:linear-gradient(145deg,rgba(24,26,58,.94),rgba(8,17,34,.94))}.afd-protocol-row{align-items:start;display:grid;gap:9px;grid-template-columns:24px 1fr;margin-top:9px}.afd-protocol-row>span{color:#b9a8ff;font-size:9px;font-weight:900}.afd-protocol-row div{display:grid}.afd-protocol-row small{color:#6d7e96;font-size:9px;margin-top:2px}
      button:focus-visible{outline:2px solid #7cf4ff;outline-offset:2px}
      @media(max-width:1180px){.afd-layout{grid-template-columns:1fr}.afd-header{align-items:flex-start;flex-direction:column}.afd-battlefield{height:500px}.afd-exit{align-self:flex-start}}
    `;

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
            title: "AI 舰队 · 零号防线",
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

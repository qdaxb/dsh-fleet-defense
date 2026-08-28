window.__ModuleLoader__.load({
  id: "@wegent/ai-fleet-defense",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const {
      Suspense,
      createElement: h,
      lazy,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
    } = React;
    const PACKAGE_NAME = "@wegent/ai-fleet-defense";
    const UNIT = "ai_fleet_defense";
    const DESCRIPTOR = {
      version: 1,
      tables: ["scores", "dodge_scores"],
      has_global: false,
    };
    const STATE_PATH = "/ai-fleet-defense/v1/state";
    const BACKGROUND_PATH =
      "/ai-fleet-defense/assets/neural-rift-battlefield.png";
    const GAME_SECONDS = 180;
    const BOSS_SECONDS = 120;
    const RECOMMENDED_PARALLEL_UNITS = 4;
    const MAX_ACTIVE_ENEMIES = 22;
    const WINGMAN_PROJECTILE_OFFSETS = [-9.5, 9.2, -6, 5.7, 0];
    const ENEMY_BLUEPRINTS = {
      scout: {
        name: "深空猎手",
        baseHp: 34,
        hpGrowth: 0.42,
        speed: 11.5,
        speedGrowth: 55,
        breachDamage: 11,
        score: 100,
        comboScore: 8,
      },
      heavy: {
        name: "重装破阵舰",
        baseHp: 74,
        hpGrowth: 0.65,
        speed: 7,
        speedGrowth: 90,
        breachDamage: 20,
        score: 240,
        comboScore: 10,
      },
      striker: {
        name: "跃迁突袭舰",
        baseHp: 48,
        hpGrowth: 0.48,
        speed: 13.8,
        speedGrowth: 72,
        breachDamage: 15,
        score: 165,
        comboScore: 9,
      },
      shield: {
        name: "棱镜护卫舰",
        baseHp: 62,
        hpGrowth: 0.56,
        speed: 8.4,
        speedGrowth: 105,
        breachDamage: 18,
        score: 230,
        comboScore: 11,
        baseShield: 42,
        shieldGrowth: 0.3,
      },
      carrier: {
        name: "蜂群播种舰",
        baseHp: 112,
        hpGrowth: 0.72,
        speed: 6.2,
        speedGrowth: 150,
        breachDamage: 28,
        score: 360,
        comboScore: 13,
      },
      drone: {
        name: "裂隙无人机",
        baseHp: 24,
        hpGrowth: 0.24,
        speed: 15.5,
        speedGrowth: 95,
        breachDamage: 8,
        score: 70,
        comboScore: 6,
      },
    };

    const LazyBulletDodgeRoute = lazy(() =>
      import("/ai-fleet-defense/dodge/route.js").then((module) => ({
        default: module.createBulletDodgeRoute(React),
      })),
    );
    const LazyGameHubRoute = lazy(() =>
      import("/ai-fleet-defense/hub/route.js").then((module) => ({
        default: module.createGameHubRoute(React),
      })),
    );

    function GameHubRoute() {
      return h(
        Suspense,
        { fallback: routeFallback("正在装载 AI Token 游戏场…") },
        h(LazyGameHubRoute),
      );
    }

    function BulletDodgeRoute() {
      return h(
        Suspense,
        { fallback: routeFallback("正在装载飞行训练空域…") },
        h(LazyBulletDodgeRoute),
      );
    }

    function routeFallback(message) {
      return h(
        "main",
        { className: "afd-page" },
        h("style", null, gameCss),
        h("div", { className: "afd-card" }, message),
      );
    }

    function FleetDefenseRoute() {
      const [telemetry, setTelemetry] = useState(emptyTelemetry);
      const [game, setGame] = useState(createGame);
      const [leaderboard, setLeaderboard] = useState([]);
      const [storageError, setStorageError] = useState("");
      const [ultimateDeniedTick, setUltimateDeniedTick] = useState(0);
      const telemetryRef = useRef(telemetry);
      const inputRef = useRef({ lane: 1, ultimate: false, tactical: null });
      const submittedScoreRef = useRef(null);
      const gameRef = useRef(game);
      gameRef.current = game;
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
        const requestTactical = (tactical) => {
          if (gameRef.current.status === "running")
            inputRef.current.tactical = tactical;
        };
        const onKey = (event) => {
          if (event.key === "ArrowUp" || event.key.toLowerCase() === "w")
            inputRef.current.lane = Math.max(0, inputRef.current.lane - 1);
          if (event.key === "ArrowDown" || event.key.toLowerCase() === "s")
            inputRef.current.lane = Math.min(2, inputRef.current.lane + 1);
          if (event.key === " ") {
            event.preventDefault();
            const current = gameRef.current;
            if (current.status !== "running") {
              submittedScoreRef.current = null;
              setGame(createGame(true));
            } else if (current.ultimate >= 100)
              inputRef.current.ultimate = true;
            else
              setUltimateDeniedTick((value) => value + 1);
          }
          if (event.key === "1") requestTactical("emp");
          if (event.key === "2") requestTactical("repair");
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
          const input = inputRef.current;
          const ultimateRequested = input.ultimate;
          const tacticalRequested = input.tactical;
          input.ultimate = false;
          input.tactical = null;
          setGame((current) =>
            advanceGame(
              current,
              {
                ...input,
                ultimate: ultimateRequested,
                tactical: tacticalRequested,
              },
              telemetryRef.current,
              dt,
            ),
          );
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
              h("p", null, "旗舰负责引导火力；至少 4 个并发 AI 才能形成完整防线"),
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
            "div",
            { className: "afd-header-actions" },
            h(
              "button",
              {
                type: "button",
                className: "afd-exit",
                onClick: () => navigateTo("/ai-token-games"),
              },
              "返回游戏大厅",
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
                  `${Math.max(0, Math.round(game.hp))}%${
                    game.barrierTimer > 0 ? " ◈" : ""
                  }`,
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
                    className:
                      projectile.source === "wingman"
                        ? "afd-projectile afd-projectile-wingman"
                        : "afd-projectile",
                    key: projectile.id,
                    style: {
                      left: `${projectile.x}%`,
                      top: `${
                        16.667 +
                        projectile.lane * 33.333 +
                        (projectile.yOffset ?? 0)
                      }%`,
                      width: `${28 + projectile.power * 5}px`,
                    },
                  }),
                ),
                game.enemies.map((enemy) =>
                  h(
                    "div",
                    {
                      className: [
                        "afd-enemy-wrap",
                        `afd-enemy-kind-${enemy.kind}`,
                        enemy.elite ? "afd-enemy-elite" : "",
                      ]
                        .join(" ")
                        .trim(),
                      key: enemy.id,
                      style: {
                        left: `${Math.max(9, enemy.x)}%`,
                        top: `${16.667 + enemy.lane * 33.333}%`,
                      },
                    },
                    h(
                      "div",
                      { className: enemy.boss ? "afd-boss-label" : "afd-enemy-label" },
                      enemy.boss
                        ? "NEMESIS // 母体"
                        : `${enemy.elite ? "ELITE // " : ""}${enemyName(enemy.kind)}`,
                    ),
                    h(EnemyShip, { boss: enemy.boss, kind: enemy.kind }),
                    enemy.maxShield
                      ? h(
                          "div",
                          {
                            className: "afd-enemy-shield",
                            title: "棱镜护盾",
                          },
                          h("span", {
                            style: {
                              width: `${Math.max(
                                0,
                                (enemy.shield / enemy.maxShield) * 100,
                              )}%`,
                            },
                          }),
                        )
                      : null,
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
                        : burst.kind === "emp"
                          ? "afd-emp-burst"
                          : burst.kind === "repair"
                            ? "afd-repair-burst"
                            : burst.kind === "breach"
                              ? "afd-breach-burst"
                              : burst.source === "wingman"
                                ? "afd-impact-burst afd-impact-burst-wingman"
                                : "afd-impact-burst",
                    key: burst.id,
                    style: {
                      left: `${burst.x + (burst.xOffset ?? 0)}%`,
                      top: `${
                        16.667 +
                        burst.lane * 33.333 +
                        (burst.yOffset ?? 0)
                      }%`,
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
                    h("span", null, "TACTICAL ENERGY // 战术能量"),
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
                      : "可提前使用战术道具，也可蓄满释放裂隙核爆",
                  ),
                ),
                h(
                  "div",
                  { className: "afd-tactical-buttons" },
                  tacticalButton(
                    "1",
                    "EMP 脉冲",
                    "40",
                    game.ultimate >= 40,
                    game.empTimer > 0,
                    () => {
                      inputRef.current.tactical = "emp";
                    },
                  ),
                  tacticalButton(
                    "2",
                    "维修蜂群",
                    "55",
                    game.ultimate >= 55 && game.hp < 100,
                    game.barrierTimer > 0,
                    () => {
                      inputRef.current.tactical = "repair";
                    },
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      key: ultimateDeniedTick,
                      className: [
                        "afd-ultimate",
                        game.ultimate >= 100 ? "afd-ultimate-ready" : "",
                        ultimateDeniedTick ? "afd-ultimate-denied" : "",
                      ]
                        .join(" ")
                        .trim(),
                      disabled: game.ultimate < 100,
                      "data-testid": "ai-fleet-defense-ultimate",
                      onClick: () => {
                        if (gameRef.current.ultimate >= 100)
                          inputRef.current.ultimate = true;
                        else setUltimateDeniedTick((value) => value + 1);
                      },
                    },
                    h("small", null, "SPACE"),
                    h(
                      "b",
                      null,
                      game.ultimate >= 100 ? "裂隙核爆" : "100 能量",
                    ),
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
                  h("b", null, "单舰只能拖延，四机协同才能稳定守住终局"),
                  h(
                    "small",
                    null,
                    "旗舰与每架僚机都会发射独立弹道；Wework 会把所有执行中 Session 的实时输出转化为齐射规模、射速、伤害与充能加成",
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
                    h("p", null, "基础自动炮只能拖延敌军，无法独立守住终局。"),
                    h(
                      "small",
                      null,
                      "建议并行启动至少 4 个 AI 任务组成完整舰队。",
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
              protocol("02", "旗舰自动开火", "基础火力只能延缓敌军推进"),
              protocol("03", "四机成阵", "建议至少 4 个并发任务稳定通关"),
              protocol("04", "使用战术道具", "按 1 释放 EMP，按 2 呼叫维修"),
              protocol("05", "释放裂隙核爆", "对全场造成伤害，Boss 不会被秒杀"),
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
                  "旗舰自带基础反应堆，但单舰火力不足以守住终局",
                ),
                briefing(
                  "03",
                  "召集 AI 舰队",
                  "每个执行中任务都会增强火力，至少 4 并发才有稳定胜算",
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
              h("b", null, "SPACE"),
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
                  ? telemetry.activeSessions >= RECOMMENDED_PARALLEL_UNITS
                    ? `完整舰队就绪：${telemetry.activeSessions} 个 AI 作战单元已连接`
                    : `战力不足：还需 ${RECOMMENDED_PARALLEL_UNITS - telemetry.activeSessions} 个 AI 作战单元形成完整舰队`
                  : "旗舰基础火力在线，但需要至少 4 个 AI 作战单元增援",
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
      const variants = {
        scout: {
          path: "M96 35 66 8 39 20 4 35l35 15 27 12Z",
          fill: "#31162a",
          stroke: "#ff5d78",
          width: 58,
          height: 42,
          coreX: 51,
          coreRadius: 6,
        },
        heavy: {
          path: "M96 35 69 4 37 17 5 35l32 18 32 13Z",
          fill: "#46162b",
          stroke: "#ff829c",
          width: 72,
          height: 52,
          coreX: 46,
          coreRadius: 8,
        },
        striker: {
          path: "M98 35 58 9 67 27 7 35l60 8-9 18Z",
          fill: "#4a123e",
          stroke: "#ff63d7",
          width: 62,
          height: 44,
          coreX: 57,
          coreRadius: 6,
        },
        shield: {
          path: "M95 35 70 8 29 10 5 35l24 25 41 2Z",
          fill: "#182d4f",
          stroke: "#78d9ff",
          width: 70,
          height: 50,
          coreX: 48,
          coreRadius: 8,
        },
        carrier: {
          path: "M97 35 75 5 48 14 18 7 4 35l14 28 30-7 27 9Z",
          fill: "#4b1d35",
          stroke: "#ffb064",
          width: 80,
          height: 58,
          coreX: 49,
          coreRadius: 10,
        },
        drone: {
          path: "M96 35 61 17 37 27 6 35l31 8 24 10Z",
          fill: "#401323",
          stroke: "#ffcf72",
          width: 46,
          height: 34,
          coreX: 52,
          coreRadius: 5,
        },
      };
      const variant = variants[kind] ?? variants.scout;
      return h(
        "svg",
        {
          className: "afd-enemy",
          viewBox: "0 0 100 70",
          width: variant.width,
          height: variant.height,
        },
        h("path", {
          d: variant.path,
          fill: variant.fill,
          stroke: variant.stroke,
          strokeWidth: kind === "heavy" || kind === "carrier" ? "3" : "2",
        }),
        h("circle", {
          cx: variant.coreX,
          cy: "35",
          r: variant.coreRadius,
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

    function tacticalButton(key, label, cost, enabled, active, onClick) {
      return h(
        "button",
        {
          type: "button",
          className: [
            "afd-tactical",
            enabled ? "afd-tactical-ready" : "",
            active ? "afd-tactical-active" : "",
          ]
            .join(" ")
            .trim(),
          disabled: !enabled,
          onClick,
        },
        h("small", null, key),
        h("b", null, label),
        h("span", null, active ? "生效中" : `${cost} 能量`),
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
        empTimer: 0,
        barrierTimer: 0,
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
          .filter(
            (burst) =>
              burst.age <
              (burst.kind === "ultimate"
                ? 0.9
                : burst.kind === "emp" || burst.kind === "repair"
                  ? 0.8
                  : burst.kind === "breach"
                    ? 0.75
                    : 0.5),
          ),
        elapsed: game.elapsed + dt,
        playerLane: input.lane,
        shotCooldown: game.shotCooldown - dt,
        spawnCooldown: game.spawnCooldown - dt,
        empTimer: Math.max(0, game.empTimer - dt),
        barrierTimer: Math.max(0, game.barrierTimer - dt),
        wave: Math.min(12, 1 + Math.floor((game.elapsed + dt) / 16)),
        ultimate: Math.min(
          100,
          game.ultimate + dt * Number(telemetry.ultimateChargePerSecond ?? 4),
        ),
      };
      const tps = Math.max(0, Number(telemetry.tokensPerSecond ?? 0));
      const active = Math.max(0, Number(telemetry.activeSessions ?? 0));
      const synergy = Math.max(1, Number(telemetry.synergy ?? 1));

      const fleetReadiness = Math.min(
        1,
        active / RECOMMENDED_PARALLEL_UNITS,
      );
      const fireInterval = Math.max(
        0.14,
        0.88 - fleetReadiness * 0.38 - Math.log1p(tps) * 0.045,
      );
      const damage = 9 + fleetReadiness * 18 + Math.sqrt(tps) * 1.15;
      const wingmanCount = Math.min(5, Math.floor(active));
      const volleySize = 1 + wingmanCount;
      const volleyDamage = damage * synergy;
      while (next.shotCooldown <= 0) {
        next.shotCooldown += fireInterval;
        const target = next.enemies
          .filter((enemy) => enemy.lane === next.playerLane)
          .sort((left, right) => left.x - right.x)[0];
        if (target) {
          for (let emitter = 0; emitter < volleySize; emitter += 1) {
            const wingmanIndex = emitter - 1;
            next.projectiles.push({
              id: `p-${next.nextEffectId++}`,
              lane: next.playerLane,
              x: emitter === 0 ? 13 : 10 + (wingmanIndex % 2) * 2,
              yOffset:
                emitter === 0
                  ? 0
                  : WINGMAN_PROJECTILE_OFFSETS[wingmanIndex],
              age: 0,
              power: Math.min(
                4,
                (emitter === 0 ? 1 : 0.65) + tps / 80,
              ),
              damage: volleyDamage / volleySize,
              source: emitter === 0 ? "flagship" : "wingman",
              impactXOffset:
                emitter === 0
                  ? 0
                  : (wingmanIndex % 2 === 0 ? -1 : 1) *
                    (1.2 + Math.floor(wingmanIndex / 2) * 0.8),
            });
          }
        }
      }

      if (input.tactical === "emp" && next.ultimate >= 40) {
        next.ultimate -= 40;
        next.empTimer = Math.max(next.empTimer, 6);
        for (const enemy of next.enemies) {
          enemy.shield = Math.max(0, enemy.shield - 55);
          next.bursts.push({
            id: `e-${next.nextEffectId++}`,
            lane: enemy.lane,
            x: enemy.x,
            age: 0,
            kind: "emp",
          });
        }
      }
      if (
        input.tactical === "repair" &&
        next.ultimate >= 55 &&
        next.hp < 100
      ) {
        next.ultimate -= 55;
        next.hp = Math.min(100, next.hp + 28);
        next.barrierTimer = Math.max(next.barrierTimer, 8);
        next.bursts.push({
          id: `r-${next.nextEffectId++}`,
          lane: next.playerLane,
          x: 13,
          age: 0,
          kind: "repair",
        });
      }

      if (input.ultimate && next.ultimate >= 100) {
        next.ultimate = 0;
        const blastDamage =
          110 + Math.min(90, Math.sqrt(tps) * 5);
        for (const enemy of next.enemies) {
          let remainingDamage = enemy.boss
            ? Math.min(240, blastDamage * 0.75)
            : blastDamage;
          if (enemy.shield > 0) {
            const absorbed = Math.min(enemy.shield, remainingDamage);
            enemy.shield -= absorbed;
            remainingDamage -= absorbed;
          }
          enemy.hp -= remainingDamage;
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
        const availableSlots = MAX_ACTIVE_ENEMIES - next.enemies.length;
        const legacyHeavy =
          Math.random() < Math.min(0.62, next.elapsed / 260);
        if (boss && availableSlots > 0) {
          next.enemies.push(createBoss(next));
          if (availableSlots > 1)
            next.enemies.push(createEnemy(next, "striker", 0, 99, false));
          if (availableSlots > 2)
            next.enemies.push(createEnemy(next, "shield", 2, 99, false));
        } else {
          const batchSize = Math.min(
            availableSlots,
            next.elapsed >= 150
              ? 2 + (Math.random() < 0.32 ? 1 : 0)
              : next.elapsed >= 105 && Math.random() < 0.48
                ? 2
                : 1,
          );
          for (let index = 0; index < batchSize; index += 1) {
            const kind = chooseEnemyKind(
              next.elapsed,
              Math.random(),
              legacyHeavy,
            );
            const lane =
              batchSize >= 3 ? index % 3 : Math.floor(Math.random() * 3);
            const elite =
              next.elapsed >= 138 &&
              Math.random() <
                Math.min(0.36, 0.1 + (next.elapsed - 138) / 180);
            next.enemies.push(
              createEnemy(next, kind, lane, 95 + index * 3, elite),
            );
          }
        }
        next.spawnCooldown = boss
          ? 2.6
          : Math.max(
              0.46,
              1.15 -
                next.elapsed / 230 -
                Math.max(0, next.elapsed - BOSS_SECONDS) / 170,
            );
      }

      const deployedDrones = [];
      for (const enemy of next.enemies) {
        const speed = enemy.boss
          ? 4.5
          : enemy.kind === "heavy"
            ? 7 + next.elapsed / 90
            : enemy.kind === "scout"
              ? 11.5 + next.elapsed / 55
              : enemySpeed(enemy, next.elapsed);
        const empSlow = next.empTimer > 0 ? 0.42 : 1;
        enemy.x -= dt * speed * (enemy.elite ? 1.1 : 1) * empSlow;
        if (enemy.kind === "striker") {
          enemy.laneShiftCooldown -= dt;
          if (enemy.laneShiftCooldown <= 0 && enemy.x > 34) {
            const direction =
              enemy.lane === 0
                ? 1
                : enemy.lane === 2
                  ? -1
                  : Math.random() < 0.5
                    ? -1
                    : 1;
            enemy.lane += direction;
            enemy.laneShiftCooldown = 2.2 + Math.random() * 1.4;
          }
        }
        if (enemy.kind === "carrier" && !enemy.deployed && enemy.x <= 58) {
          enemy.deployed = true;
          for (const laneOffset of [-1, 1]) {
            const lane = enemy.lane + laneOffset;
            if (
              lane >= 0 &&
              lane <= 2 &&
              next.enemies.length + deployedDrones.length <
                MAX_ACTIVE_ENEMIES
            )
              deployedDrones.push(
                createEnemy(next, "drone", lane, enemy.x + 4, enemy.elite),
              );
          }
        }
      }
      next.enemies.push(...deployedDrones);
      const flyingProjectiles = [];
      for (const projectile of next.projectiles) {
        const target = next.enemies
          .filter(
            (enemy) =>
              enemy.hp > 0 &&
              enemy.x > 9 &&
              enemy.lane === projectile.lane &&
              enemy.x <= projectile.x,
          )
          .sort((left, right) => left.x - right.x)[0];
        if (!target) {
          flyingProjectiles.push(projectile);
          continue;
        }
        let remainingDamage = projectile.damage;
        if (target.shield > 0) {
          const absorbed = Math.min(target.shield, remainingDamage);
          target.shield -= absorbed;
          remainingDamage -= absorbed;
        }
        target.hp -= remainingDamage;
        next.bursts.push({
          id: `i-${next.nextEffectId++}`,
          lane: target.lane,
          x: target.x,
          age: 0,
          kind: "impact",
          source: projectile.source,
          xOffset: projectile.impactXOffset,
          yOffset: projectile.yOffset,
        });
      }
      next.projectiles = flyingProjectiles;
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
              : enemyScore(enemy, next.combo)),
          0,
        );
      }
      const breached = next.enemies.filter(
        (enemy) => enemy.hp > 0 && enemy.x <= 9,
      );
      if (breached.length) {
        const breachDamage = breached.reduce(
          (total, enemy) =>
            total + (enemy.boss ? 55 : enemyBreachDamage(enemy)),
          0,
        );
        next.hp -= breachDamage * (next.barrierTimer > 0 ? 0.6 : 1);
        for (const enemy of breached) {
          next.bursts.push({
            id: `b-${next.nextEffectId++}`,
            lane: enemy.lane,
            x: 9,
            age: 0,
            kind: "breach",
          });
        }
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

    function chooseEnemyKind(elapsed, roll, legacyHeavy) {
      if (elapsed >= 105 && roll < 0.17) return "carrier";
      if (elapsed >= 72 && roll < 0.36) return "shield";
      if (elapsed >= 38 && roll < 0.58) return "striker";
      return legacyHeavy ? "heavy" : "scout";
    }

    function createEnemy(game, kind, lane, x = 95, elite = false) {
      const blueprint = ENEMY_BLUEPRINTS[kind];
      const eliteMultiplier = elite ? 1.35 : 1;
      const maxHp =
        (blueprint.baseHp + game.elapsed * blueprint.hpGrowth) *
        eliteMultiplier;
      const maxShield = blueprint.baseShield
        ? (blueprint.baseShield + game.elapsed * blueprint.shieldGrowth) *
          eliteMultiplier
        : 0;
      return {
        id: game.nextEnemyId++,
        lane,
        x,
        hp: maxHp,
        maxHp,
        shield: maxShield,
        maxShield,
        boss: false,
        kind,
        elite,
        deployed: false,
        laneShiftCooldown: 1.6 + Math.random() * 1.6,
      };
    }

    function createBoss(game) {
      return {
        id: game.nextEnemyId++,
        lane: 1,
        x: 95,
        hp: 1600,
        maxHp: 1600,
        shield: 0,
        maxShield: 0,
        boss: true,
        kind: "heavy",
        elite: false,
      };
    }

    function enemySpeed(enemy, elapsed) {
      const blueprint = ENEMY_BLUEPRINTS[enemy.kind];
      return blueprint.speed + elapsed / blueprint.speedGrowth;
    }

    function enemyScore(enemy, combo) {
      const blueprint = ENEMY_BLUEPRINTS[enemy.kind];
      return (
        blueprint.score +
        Math.min(720, combo * blueprint.comboScore) +
        (enemy.elite ? 180 : 0)
      );
    }

    function enemyBreachDamage(enemy) {
      const damage = ENEMY_BLUEPRINTS[enemy.kind].breachDamage;
      return Math.round(damage * (enemy.elite ? 1.3 : 1));
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
      if (activeSessions >= RECOMMENDED_PARALLEL_UNITS) return "完整战阵";
      if (activeSessions > 0)
        return `还差 ${RECOMMENDED_PARALLEL_UNITS - activeSessions} 个形成战阵`;
      return "至少需要 4 个并发";
    }

    function enemyName(kind) {
      return ENEMY_BLUEPRINTS[kind]?.name ?? ENEMY_BLUEPRINTS.scout.name;
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
      navigateTo(workbenchPath());
    }

    function navigateTo(target) {
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
      ultimateChargePerSecond: 1.6,
      sessions: [],
    };

    const gameCss = `
      @keyframes afd-pulse{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
      @keyframes afd-float{0%,100%{transform:translateY(-50%) translateY(-2px)}50%{transform:translateY(-50%) translateY(3px)}}
      @keyframes afd-wing{0%,100%{transform:translateY(-2px)}50%{transform:translateY(3px)}}
      @keyframes afd-enemy{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(2deg)}}
      @keyframes afd-impact{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.5)}}
      @keyframes afd-ultimate{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(6)}}
      @keyframes afd-emp{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(4.6)}}
      @keyframes afd-repair{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}45%{opacity:.9}100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)}}
      @keyframes afd-breach{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}35%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(3.8)}}
      @keyframes afd-ready{0%,100%{box-shadow:0 0 20px rgba(77,232,255,.25)}50%{box-shadow:0 0 42px rgba(77,232,255,.72)}}
      @keyframes afd-denied{0%,100%{box-shadow:0 0 0 rgba(255,93,120,0)}20%,60%{box-shadow:0 0 22px rgba(255,93,120,.85);border-color:#ff5d78;color:#ffb3c2}} .afd-ultimate-denied{animation:afd-denied .7s ease-out}
      .afd-exit{background:rgba(79,111,145,.12);border:1px solid rgba(126,178,219,.28);border-radius:9px;color:#9fd6ec;cursor:pointer;font-size:11px;font-weight:700;min-height:34px;padding:0 13px;transition:.2s}.afd-exit:hover{background:rgba(126,218,244,.16);border-color:rgba(126,218,244,.5);color:#e9fbff}.afd-exit-overlay{align-self:center;margin-top:10px}
      .afd-overlay-actions{align-items:center;display:flex;flex-direction:column}
      .afd-page{background:radial-gradient(circle at 42% 0,#101e38 0,#07101f 36%,#030813 76%);box-sizing:border-box;color:#eef8ff;font-family:Inter,"SF Pro Display","PingFang SC","Microsoft YaHei",sans-serif;min-height:100%;padding:22px 24px 32px}
      .afd-header{align-items:center;display:flex;gap:24px;justify-content:space-between;margin:0 auto 18px;max-width:1760px}.afd-header-actions{display:flex;gap:8px}
      .afd-brand{align-items:center;display:flex;gap:14px}.afd-brand h1{font-size:26px;letter-spacing:-.5px;line-height:1;margin:0}.afd-brand p{color:#7f9ab2;font-size:12px;margin:7px 0 0}
      .afd-brand-mark{align-items:center;display:flex;height:48px;justify-content:center;position:relative;width:48px}.afd-brand-core{background:#d9fbff;border-radius:50%;box-shadow:0 0 20px #4de8ff;height:12px;position:absolute;width:12px}.afd-brand-orbit{border:1px solid #4de8ff;border-radius:50%;height:36px;position:absolute;transform:rotate(-30deg) scaleY(.45);width:36px}.afd-eyebrow{color:#64dff2;font-size:10px;font-weight:800;letter-spacing:2.4px;margin-bottom:4px}
      .afd-metrics{display:flex;gap:9px}.afd-metric{background:linear-gradient(145deg,rgba(21,39,65,.9),rgba(8,19,35,.88));border:1px solid rgba(117,168,207,.18);border-radius:12px;display:grid;min-width:130px;padding:10px 13px}.afd-metric>span{color:#7690a8;font-size:10px}.afd-metric i{border-radius:50%;float:right;height:5px;margin-top:4px;width:5px}.afd-metric b{font-size:19px;margin-top:3px}.afd-metric small{color:#5f768c;font-size:9px}
      .afd-layout{display:grid;gap:14px;grid-template-columns:minmax(760px,1fr) 320px;margin:0 auto;max-width:1760px}.afd-main-column{display:grid;gap:12px;min-width:0}.afd-game-shell{background:rgba(7,16,30,.86);border:1px solid rgba(102,160,202,.2);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
      .afd-hud{background:linear-gradient(180deg,#0d1b30,#091524);border-bottom:1px solid rgba(112,165,202,.18);display:grid;grid-template-columns:repeat(6,1fr);min-height:62px}.afd-hud-item{border-right:1px solid rgba(112,165,202,.13);display:grid;gap:3px;padding:14px 16px}.afd-hud-item span{color:#668098;font-size:8px;letter-spacing:1px}.afd-hud-item b{font-size:13px}.afd-hud-item.afd-alert b{color:#ff6886}
      .afd-battlefield{background-color:#040b18;background-position:center;background-size:cover;height:560px;overflow:hidden;position:relative}.afd-scanlines{background:repeating-linear-gradient(180deg,transparent 0,transparent 3px,rgba(117,221,255,.025) 4px);inset:0;pointer-events:none;position:absolute;z-index:7}.afd-vignette{background:radial-gradient(ellipse at center,transparent 38%,rgba(1,5,14,.58) 100%);inset:0;pointer-events:none;position:absolute;z-index:6}
      .afd-mission-badge{align-items:center;background:rgba(5,16,31,.65);border:1px solid rgba(92,198,225,.2);border-radius:999px;color:#a6bfd2;display:flex;font-size:10px;gap:7px;left:18px;letter-spacing:1.4px;padding:6px 10px;position:absolute;top:16px;z-index:8}.afd-mission-badge i,.afd-ready-state i{animation:afd-pulse 1.4s infinite;background:#4de8ff;border-radius:50%;box-shadow:0 0 8px #4de8ff;height:6px;width:6px}.afd-enemy-zone{color:rgba(255,112,140,.72);font-size:9px;letter-spacing:2px;position:absolute;right:18px;top:19px;z-index:8}
      .afd-lane{appearance:none;background:transparent;border:0;border-bottom:1px solid rgba(128,167,197,.08);box-sizing:border-box;cursor:pointer;height:33.333%;left:0;padding:0;position:absolute;right:0;transition:.25s;z-index:1}.afd-lane-active{background:linear-gradient(90deg,rgba(77,232,255,.08),transparent 58%);border-color:rgba(77,232,255,.32)}.afd-lane span{color:#678096;font-size:8px;font-weight:800;left:16px;letter-spacing:1.2px;position:absolute;top:12px}.afd-lane-active span{color:#7cf4ff}
      .afd-player-formation{height:1px;left:8%;position:absolute;transition:top .2s cubic-bezier(.2,.8,.2,1);width:1px;z-index:4}.afd-player-label{background:rgba(5,20,35,.8);border:1px solid rgba(77,232,255,.36);border-radius:5px;font-size:8px;left:18px;padding:3px 6px;position:absolute;top:-52px;white-space:nowrap}.afd-player{animation:afd-float 2.2s infinite;filter:drop-shadow(0 0 9px rgba(77,232,255,.4));left:-24px;position:absolute;top:0}.afd-player.boosted{filter:drop-shadow(0 0 15px rgba(77,232,255,.9))}.afd-engine-trail{background:linear-gradient(90deg,transparent,rgba(77,232,255,.8));filter:blur(3px);height:10px;left:-24px;position:absolute;top:30px;width:44px}
      .afd-wingman{animation:afd-wing 1.7s infinite;position:absolute}.afd-wingman>span{background:linear-gradient(90deg,transparent,rgba(132,126,255,.82));filter:blur(2px);height:4px;left:-14px;position:absolute;top:10px;width:24px}.afd-projectile{background:linear-gradient(90deg,transparent,#fff 72%,#4de8ff);border-radius:99px;box-shadow:0 0 14px #4de8ff;height:3px;position:absolute;transform:translateY(-50%);z-index:3}.afd-projectile-wingman{background:linear-gradient(90deg,transparent,#fff 68%,#b59cff);box-shadow:0 0 14px #8d7dff;height:2px}
      .afd-enemy-wrap{align-items:center;display:flex;flex-direction:column;position:absolute;transform:translate(-50%,-50%);z-index:4}.afd-enemy-wrap::before{background:linear-gradient(90deg,transparent,rgba(255,70,104,.72));content:"";filter:blur(1px);height:4px;position:absolute;right:88%;top:50%;transform:translateY(-50%);width:64px}.afd-enemy-wrap::after{background:linear-gradient(90deg,transparent,rgba(255,166,187,.3));content:"";filter:blur(3px);height:12px;position:absolute;right:84%;top:50%;transform:translateY(-50%);width:34px}.afd-enemy-kind-striker::before{background:linear-gradient(90deg,transparent,rgba(255,80,220,.9));width:82px}.afd-enemy-kind-shield::after{background:linear-gradient(90deg,transparent,rgba(89,208,255,.55));height:18px}.afd-enemy-kind-carrier::before{background:linear-gradient(90deg,transparent,rgba(255,168,82,.88));height:6px;width:76px}.afd-enemy-kind-drone::before{background:linear-gradient(90deg,transparent,rgba(255,216,112,.92));width:46px}.afd-enemy-elite{filter:drop-shadow(0 0 9px rgba(255,218,94,.8))}.afd-enemy-elite .afd-enemy-label{color:#ffe27e;font-weight:900}.afd-enemy,.afd-boss{animation:afd-enemy .9s ease-in-out infinite;filter:drop-shadow(0 0 12px rgba(255,49,93,.65))}.afd-enemy-label{color:#ff96a9;font-size:7px;letter-spacing:.8px}.afd-boss-label{background:rgba(74,4,31,.8);border:1px solid rgba(255,93,120,.5);border-radius:4px;color:#ffd4dd;font-size:8px;font-weight:800;letter-spacing:1.1px;padding:3px 7px}.afd-enemy-shield,.afd-enemy-health{background:rgba(12,3,12,.8);border-radius:99px;height:4px;overflow:hidden}.afd-enemy-shield{border:1px solid rgba(105,223,255,.48);margin-bottom:2px;width:58px}.afd-enemy-shield span{background:linear-gradient(90deg,#368dff,#8ef5ff);box-shadow:0 0 9px #59dfff;display:block;height:100%;transition:width .12s}.afd-enemy-health{border:1px solid rgba(255,117,145,.35)}.afd-enemy-health span{background:linear-gradient(90deg,#ff315d,#ff9aae);box-shadow:0 0 8px #ff315d;display:block;height:100%;transition:width .12s}
      .afd-impact-burst,.afd-ultimate-burst,.afd-emp-burst,.afd-repair-burst,.afd-breach-burst{border-radius:50%;pointer-events:none;position:absolute}.afd-impact-burst{animation:afd-impact .5s ease-out forwards;border:2px solid #74efff;box-shadow:0 0 18px #4de8ff;height:24px;width:24px}.afd-impact-burst-wingman{background:radial-gradient(circle,rgba(255,255,255,.92),rgba(181,156,255,.42) 42%,transparent 72%);border-color:#b59cff;box-shadow:0 0 18px #8d7dff;height:20px;width:20px}.afd-ultimate-burst{animation:afd-ultimate .9s ease-out forwards;background:rgba(181,156,255,.28);border:2px solid #fff;box-shadow:0 0 50px #b59cff;height:40px;width:40px}.afd-emp-burst{animation:afd-emp .8s ease-out forwards;background:rgba(74,222,255,.2);border:2px solid #8df7ff;box-shadow:0 0 34px #2dd9ff;height:34px;width:34px}.afd-repair-burst{animation:afd-repair .8s ease-out forwards;background:rgba(82,255,187,.22);border:2px solid #8effcf;box-shadow:0 0 34px #4dffb6;height:38px;width:38px}.afd-breach-burst{animation:afd-breach .75s ease-out forwards;background:radial-gradient(circle,rgba(255,238,191,.95),rgba(255,62,102,.52) 34%,transparent 72%);border:3px solid #ff617f;box-shadow:0 0 28px #ff315d,0 0 60px rgba(255,49,93,.75);height:52px;width:52px;z-index:5}
      .afd-overlay{align-items:center;backdrop-filter:blur(5px);background:rgba(2,7,17,.48);display:flex;inset:0;justify-content:center;padding:28px;position:absolute;z-index:20}.afd-overlay-card{align-items:center;background:linear-gradient(155deg,rgba(14,32,55,.96),rgba(4,13,27,.96));border:1px solid rgba(100,218,241,.32);border-radius:18px;box-shadow:0 26px 80px rgba(0,0,0,.52);display:flex;flex-direction:column;max-width:650px;padding:32px 38px 28px;text-align:center;width:72%}.afd-overlay-kicker{color:#58e4f7;font-size:9px;font-weight:800;letter-spacing:2.8px}.afd-overlay-card h2{font-size:28px;margin:8px 0 24px}.afd-briefing{display:grid;gap:9px;text-align:left;width:100%}.afd-briefing-row{align-items:center;background:rgba(116,177,219,.06);border:1px solid rgba(116,177,219,.12);border-radius:10px;display:grid;gap:12px;grid-template-columns:34px 1fr;padding:10px 13px}.afd-briefing-row>span{color:#53e6f8;font-size:11px;font-weight:900}.afd-briefing-row p{color:#829caf;font-size:10px;margin:3px 0 0}.afd-start{align-items:center;animation:afd-ready 2s infinite;background:linear-gradient(135deg,#66f1ff,#668dff);border:0;border-radius:9px;color:#03101f;cursor:pointer;display:flex;font-size:14px;font-weight:900;justify-content:space-between;margin-top:20px;padding:12px 16px;width:210px}.afd-ready-state{align-items:center;color:#8fa9be;display:flex;font-size:10px;gap:8px;margin-top:14px}.afd-result{display:grid;gap:5px}.afd-result strong{font-size:38px}
      .afd-command-bar{align-items:center;background:linear-gradient(180deg,#0c192c,#081321);border-top:1px solid rgba(112,165,202,.16);display:grid;gap:14px;grid-template-columns:122px minmax(170px,1fr) 300px;min-height:94px;padding:0 14px}.afd-move-buttons{display:flex;gap:7px}.afd-move{background:rgba(130,184,224,.08);border:1px solid rgba(130,184,224,.22);border-radius:7px;color:#e9f8ff;cursor:pointer;display:grid;height:48px;width:52px}.afd-move b{font-size:12px}.afd-move small{color:#6f879a;font-size:8px}.afd-charge{display:grid;gap:6px}.afd-charge-title{color:#83a0b7;display:flex;font-size:9px;justify-content:space-between}.afd-charge-track{background:#030a15;border:1px solid rgba(112,165,202,.18);border-radius:4px;height:12px;overflow:hidden}.afd-charge-track span{background:linear-gradient(90deg,#2571ff,#46eaff 58%,#d3fbff);box-shadow:0 0 18px #4de8ff;display:block;height:100%}.afd-charge small{color:#526b82;font-size:9px}.afd-tactical-buttons{display:grid;gap:6px;grid-template-columns:1fr 1fr 1.15fr}.afd-tactical,.afd-ultimate{background:rgba(79,111,145,.11);border:1px solid rgba(112,165,202,.2);border-radius:9px;color:#60788f;display:grid;min-height:58px;padding:5px 7px}.afd-tactical small,.afd-ultimate small{font-size:8px}.afd-tactical b,.afd-ultimate b{font-size:10px}.afd-tactical span{font-size:7px}.afd-tactical-ready{background:rgba(64,186,219,.13);border-color:rgba(92,226,255,.46);color:#b9f7ff;cursor:pointer}.afd-tactical-active{box-shadow:0 0 18px rgba(78,238,255,.48);color:#fff}.afd-ultimate-ready{background:linear-gradient(135deg,#7cf4ff,#a283ff);border:0;box-shadow:0 0 24px rgba(103,225,255,.5);color:#06101e;cursor:pointer}
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
            id: "ai-token-games.route",
            icon: "gamepad-2",
            path: "/ai-token-games",
            restorePolicy: "session",
            title: "AI Token 游戏场",
          },
          GameHubRoute,
        ),
      );
      ctx.slots.inject("wework.route", () =>
        ctx.wework.ui.register(
          ctx,
          "wework.route",
          {
            id: "ai-fleet-defense.route",
            icon: "shield",
            path: "/ai-fleet-defense",
            restorePolicy: "session",
            title: "AI 舰队 · 零号防线",
          },
          FleetDefenseRoute,
        ),
      );
      ctx.slots.inject("wework.route", () =>
        ctx.wework.ui.register(
          ctx,
          "wework.route",
          {
            id: "ai-bullet-dodge.route",
            icon: "plane",
            path: "/ai-bullet-dodge",
            restorePolicy: "session",
            title: "是王牌就坚持 60 秒",
          },
          BulletDodgeRoute,
        ),
      );
      ctx.slots.inject("wework.sidebar.navigation", () =>
        ctx.wework.ui.register(ctx, "wework.sidebar.navigation", {
          id: "ai-token-games.navigation",
          activeItem: "ai-token-games",
          icon: "gamepad-2",
          label: "AI Token 游戏",
          order: 35,
          path: "/ai-token-games",
          testId: "ai-token-games-button",
        }),
      );
    };
    return module.exports;
  },
});

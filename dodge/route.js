import {
  DODGE_GAME_SECONDS,
  advanceDodgeGame,
  createDodgeGame,
} from "./engine.js";
import { loadDodgeLeaderboard, submitDodgeScore } from "./storage.js";

const STATE_PATH = "/ai-fleet-defense/v1/state";
const STYLE_PATH = "/ai-fleet-defense/dodge/styles.css";
const EMPTY_TELEMETRY = {
  activeSessions: 0,
  tokensPerSecond: 0,
  synergy: 1,
  ultimateChargePerSecond: 1.6,
  sessions: [],
};

export function createBulletDodgeRoute(React) {
  const {
    createElement: h,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
  } = React;

  function BulletDodgeRoute() {
    const [telemetry, setTelemetry] = useState(EMPTY_TELEMETRY);
    const [game, setGame] = useState(createDodgeGame);
    const [leaderboard, setLeaderboard] = useState([]);
    const [storageError, setStorageError] = useState("");
    const inputRef = useRef({
      up: false,
      down: false,
      left: false,
      right: false,
      pointer: null,
      item: null,
    });
    const gameRef = useRef(game);
    const telemetryRef = useRef(telemetry);
    const submittedScoreRef = useRef(null);
    gameRef.current = game;
    telemetryRef.current = telemetry;

    const refreshLeaderboard = useCallback(async () => {
      try {
        setLeaderboard(await loadDodgeLeaderboard());
        setStorageError("");
      } catch (error) {
        setStorageError(error instanceof Error ? error.message : String(error));
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
          if (active) setTelemetry(EMPTY_TELEMETRY);
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
      const setDirection = (event, pressed) => {
        const key = event.key.toLowerCase();
        if (key === "w" || event.key === "ArrowUp")
          inputRef.current.up = pressed;
        if (key === "s" || event.key === "ArrowDown")
          inputRef.current.down = pressed;
        if (key === "a" || event.key === "ArrowLeft")
          inputRef.current.left = pressed;
        if (key === "d" || event.key === "ArrowRight")
          inputRef.current.right = pressed;
      };
      const onKeyDown = (event) => {
        if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(
            event.key,
          )
        )
          event.preventDefault();
        setDirection(event, true);
        if (event.repeat) return;
        if (event.key === "1") inputRef.current.item = "shield";
        if (event.key === "2") inputRef.current.item = "slow";
        if (event.key === "3") inputRef.current.item = "pulse";
        if (event.key === " ") {
          if (gameRef.current.status === "running")
            inputRef.current.item = "pulse";
          else restartGame();
        }
        if (event.key === "Escape") returnToWorkbench();
      };
      const onKeyUp = (event) => setDirection(event, false);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, []);

    useEffect(() => {
      let frame = 0;
      let previous = performance.now();
      const tick = (now) => {
        const dt = Math.min(0.05, (now - previous) / 1000);
        previous = now;
        const item = inputRef.current.item;
        inputRef.current.item = null;
        setGame((current) =>
          advanceDodgeGame(
            current,
            { ...inputRef.current, item },
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
      submitDodgeScore(game)
        .then(refreshLeaderboard)
        .catch((error) =>
          setStorageError(
            error instanceof Error ? error.message : String(error),
          ),
        );
    }, [game, refreshLeaderboard]);

    const restartGame = () => {
      submittedScoreRef.current = null;
      setGame(createDodgeGame(true));
    };
    const rank = useMemo(() => {
      const index = leaderboard.findIndex(
        (row) => Number(row.value?.score) <= game.score,
      );
      return index < 0 ? leaderboard.length + 1 : index + 1;
    }, [game.score, leaderboard]);
    const chargeRate = Number(telemetry.ultimateChargePerSecond ?? 1.6);

    return h(
      "main",
      { className: "abd-page", "data-testid": "ai-bullet-dodge-page" },
      h("link", { rel: "stylesheet", href: STYLE_PATH }),
      h(
        "header",
        { className: "abd-header" },
        h(
          "div",
          { className: "abd-brand" },
          h("div", { className: "abd-brand-mark" }, "✦"),
          h(
            "div",
            null,
            h("div", { className: "abd-eyebrow" }, "TOKEN AFTERBURNER // LIVE"),
            h("h1", null, "是王牌就坚持 60 秒"),
            h("p", null, "驾驶纸翼穿过弹幕；Token 输出只加速道具充能"),
          ),
        ),
        h(
          "div",
          { className: "afd-metrics" },
          metric(
            "实时输出",
            `${formatNumber(telemetry.tokensPerSecond)} t/s`,
            telemetry.tokensPerSecond > 0 ? "充能加速中" : "基础充能",
            "#ffd866",
          ),
          metric(
            "道具充能",
            `${chargeRate.toFixed(1)}/s`,
            `${telemetry.activeSessions} 个任务在线`,
            "#72f1b8",
          ),
          metric("当前排名", `#${rank}`, "生存榜", "#ff7ab6"),
        ),
        h(
          "div",
          { className: "abd-header-actions" },
          h(
            "button",
            {
              type: "button",
              className: "abd-switch",
              onClick: () => navigateTo("/ai-token-games"),
            },
            "返回游戏大厅",
          ),
          h(
            "button",
            {
              type: "button",
              className: "afd-exit",
              "data-testid": "ai-bullet-dodge-exit",
              onClick: returnToWorkbench,
            },
            "← 返回工作台",
          ),
        ),
      ),
      h(
        "section",
        { className: "abd-layout" },
        h(
          "div",
          { className: "abd-main" },
          h(
            "div",
            { className: "abd-hud" },
            hud("SURVIVED", `${game.elapsed.toFixed(1)}s`),
            hud(
              "TIME LEFT",
              `${Math.ceil(Math.max(0, DODGE_GAME_SECONDS - game.elapsed))}s`,
            ),
            hud("LIVES", "♥".repeat(Math.max(0, game.lives)), game.lives <= 1),
            hud("GRAZE", formatNumber(game.grazes)),
            hud("SCORE", formatNumber(game.score)),
          ),
          h(
            "div",
            {
              className:
                game.slowTimer > 0 ? "abd-field abd-field-slow" : "abd-field",
              "data-testid": "ai-bullet-dodge-field",
              onPointerMove: (event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                inputRef.current.pointer = {
                  x: ((event.clientX - bounds.left) / bounds.width) * 100,
                  y: ((event.clientY - bounds.top) / bounds.height) * 100,
                };
              },
              onPointerLeave: () => {
                inputRef.current.pointer = null;
              },
            },
            h("div", { className: "abd-grid" }),
            h("div", { className: "abd-cloud abd-cloud-one" }),
            h("div", { className: "abd-cloud abd-cloud-two" }),
            h(
              "div",
              {
                className: [
                  "abd-plane-wrap",
                  game.invulnerableTimer > 0 ? "abd-plane-hit" : "",
                  game.shieldTimer > 0 ? "abd-plane-shielded" : "",
                ]
                  .join(" ")
                  .trim(),
                style: { left: `${game.player.x}%`, top: `${game.player.y}%` },
              },
              h(DodgePlane),
              h("span", { className: "abd-hitbox" }),
            ),
            game.bullets.map((bullet) =>
              h("span", {
                className:
                  bullet.kind === "orb" ? "abd-bullet abd-orb" : "abd-bullet",
                key: bullet.id,
                style: {
                  left: `${bullet.x}%`,
                  top: `${bullet.y}%`,
                  transform: `translate(-50%,-50%) scale(${bullet.radius / 1.15})`,
                },
              }),
            ),
            game.effects.map((effect) =>
              h("span", {
                className: `abd-effect abd-effect-${effect.kind}`,
                key: effect.id,
                style: { left: `${effect.x}%`, top: `${effect.y}%` },
              }),
            ),
            h(
              "div",
              { className: "abd-danger" },
              game.status === "running"
                ? game.elapsed < 15
                  ? "弹幕密度上升中"
                  : game.elapsed < 40
                    ? "高密度空域"
                    : "终局风暴"
                : "训练空域",
            ),
            game.status !== "running"
              ? h(DodgeOverlay, {
                  game,
                  telemetry,
                  onStart: restartGame,
                })
              : null,
          ),
          h(
            "div",
            { className: "abd-energy" },
            h(
              "div",
              { className: "abd-energy-copy" },
              h("small", null, "ITEM CHARGE"),
              h("b", null, `${Math.floor(game.energy)}%`),
              h(
                "span",
                null,
                telemetry.tokensPerSecond > 0
                  ? `${formatNumber(telemetry.tokensPerSecond)} token/s 正在加速`
                  : "等待 AI Token 输出可显著加快充能",
              ),
            ),
            h(
              "div",
              { className: "abd-charge-track" },
              h("span", { style: { width: `${game.energy}%` } }),
            ),
            h(
              "div",
              { className: "abd-items" },
              itemButton("1", "相位护盾", 45, game, "shield", inputRef),
              itemButton("2", "时间减速", 65, game, "slow", inputRef),
              itemButton("3 / SPACE", "清屏脉冲", 100, game, "pulse", inputRef),
            ),
          ),
        ),
        h(
          "aside",
          { className: "afd-sidebar" },
          h(
            "section",
            { className: "afd-card abd-token-card" },
            sideTitle(
              "TOKEN",
              "充能反应堆",
              telemetry.tokensPerSecond ? "BOOST" : "IDLE",
            ),
            h(
              "div",
              { className: "abd-token-number" },
              h("strong", null, formatNumber(telemetry.tokensPerSecond)),
              h("span", null, "TOKEN / 秒"),
            ),
            h(
              "p",
              null,
              "Token 不会降低弹幕难度，也不直接增加分数，只会让保命道具更快可用。",
            ),
            h(
              "div",
              { className: "abd-token-flow" },
              flow(`${telemetry.activeSessions}`, "执行中任务"),
              h("i", null, "→"),
              flow(`${chargeRate.toFixed(1)}`, "每秒充能"),
              h("i", null, "→"),
              flow("3", "战术道具"),
            ),
          ),
          h(
            "section",
            { className: "afd-card" },
            sideTitle("GLOBAL", "王牌生存榜", "LIVE"),
            leaderboardContent(leaderboard, storageError),
          ),
          h(
            "section",
            { className: "afd-card afd-protocol" },
            sideTitle("FLIGHT MANUAL", "飞行手册", "60 SEC"),
            protocol("01", "移动飞机", "鼠标跟随，或使用 WASD / 方向键"),
            protocol("02", "擦弹得分", "贴近子弹而不被命中，可获得额外分数"),
            protocol("03", "相位护盾", "45 能量，短时间内免疫碰撞"),
            protocol("04", "时间减速", "65 能量，大幅降低所有子弹速度"),
            protocol("05", "清屏脉冲", "100 能量，立即清除当前弹幕"),
          ),
        ),
      ),
    );
  }

  function DodgeOverlay({ game, telemetry, onStart }) {
    const ended = game.status === "ended";
    return h(
      "div",
      { className: "abd-overlay" },
      h(
        "div",
        { className: "abd-overlay-card" },
        h("small", null, ended ? "FLIGHT REPORT" : "READY FOR TAKEOFF"),
        h(
          "h2",
          null,
          ended
            ? game.elapsed >= DODGE_GAME_SECONDS
              ? "你就是王牌"
              : "飞机被弹幕淹没了"
            : "是王牌就坚持 60 秒",
        ),
        ended
          ? h(
              "div",
              { className: "abd-result" },
              h("strong", null, `${game.elapsed.toFixed(1)} 秒`),
              h(
                "span",
                null,
                `${formatNumber(game.score)} 分 · ${game.grazes} 次擦弹`,
              ),
            )
          : h(
              "div",
              { className: "abd-rules" },
              h("span", null, "移动", h("b", null, "鼠标 / WASD")),
              h("span", null, "目标", h("b", null, "活过 60 秒")),
              h("span", null, "Token", h("b", null, "加速道具充能")),
            ),
        h(
          "button",
          {
            type: "button",
            className: "abd-start",
            "data-testid": "ai-bullet-dodge-start",
            onClick: onStart,
          },
          ended ? "再次起飞" : "开始飞行",
          h("b", null, "SPACE"),
        ),
        h(
          "p",
          null,
          telemetry.tokensPerSecond > 0
            ? `当前 ${formatNumber(telemetry.tokensPerSecond)} token/s，道具反应堆已加速`
            : "没有 Token 输出也能游玩，道具将以基础速度充能",
        ),
      ),
    );
  }

  function DodgePlane() {
    return h(
      "svg",
      { viewBox: "0 0 90 90", width: 62, height: 62, "aria-hidden": true },
      h("path", {
        d: "M45 3 57 35 82 63 54 58 45 86 36 58 8 63 33 35Z",
        fill: "#f7fbff",
        stroke: "#78e6ff",
        strokeWidth: "2",
      }),
      h("path", {
        d: "M45 11 49 46 45 66 41 46Z",
        fill: "#ff477e",
      }),
      h("path", {
        d: "M20 58 36 49 33 57ZM70 58 54 49 57 57Z",
        fill: "#ffd866",
      }),
    );
  }

  function itemButton(key, label, cost, game, item, inputRef) {
    const active =
      (item === "shield" && game.shieldTimer > 0) ||
      (item === "slow" && game.slowTimer > 0);
    return h(
      "button",
      {
        type: "button",
        className: [
          "abd-item",
          game.energy >= cost ? "abd-item-ready" : "",
          active ? "abd-item-active" : "",
        ]
          .join(" ")
          .trim(),
        disabled: game.energy < cost,
        onClick: () => {
          inputRef.current.item = item;
        },
      },
      h("small", null, key),
      h("b", null, label),
      h("span", null, active ? "生效中" : `${cost} 能量`),
    );
  }

  function leaderboardContent(leaderboard, storageError) {
    if (storageError)
      return h(
        "div",
        { className: "afd-backend-note" },
        h("b", null, "单机训练"),
        h("small", null, "连接 Backend 后自动共享最佳成绩"),
      );
    if (!leaderboard.length)
      return h(
        "div",
        { className: "afd-empty-rank" },
        h("b", null, "等待第一位王牌"),
        h("small", null, "完成一次飞行即可留下战绩"),
      );
    return leaderboard.slice(0, 7).map((row, index) =>
      h(
        "div",
        {
          className: index === 0 ? "afd-rank afd-rank-first" : "afd-rank",
          key: `${row.owner_id}:${row.key}`,
        },
        h("b", null, String(index + 1).padStart(2, "0")),
        h("span", null, row.owner_name),
        h("strong", null, formatNumber(row.value?.score ?? 0)),
      ),
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

  function flow(value, label) {
    return h("div", null, h("b", null, value), h("small", null, label));
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

  return BulletDodgeRoute;
}

function workbenchPath() {
  const appBase = window.__WEWORK_RUNTIME_CONFIG__?.appBasePath?.replace(
    /\/+$/,
    "",
  );
  return appBase ? `${appBase}/` : "/";
}

function returnToWorkbench() {
  navigateTo(workbenchPath());
}

function navigateTo(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

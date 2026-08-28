const STYLE_PATH = "/ai-fleet-defense/hub/styles.css";
const STATE_PATH = "/ai-fleet-defense/v1/state";

export function createGameHubRoute(React) {
  const { createElement: h, useEffect, useRef, useState } = React;

  function GameHubRoute() {
    const [telemetry, setTelemetry] = useState({
      activeSessions: 0,
      tokensPerSecond: 0,
    });
    const [launching, setLaunching] = useState(null);
    const launchTimerRef = useRef(null);

    useEffect(() => {
      let active = true;
      const poll = async () => {
        try {
          const response = await fetch(STATE_PATH, { cache: "no-store" });
          if (!response.ok) return;
          const body = await response.json();
          if (active) setTelemetry(body);
        } catch {}
      };
      poll();
      const timer = setInterval(poll, 1000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []);

    useEffect(
      () => () => {
        if (launchTimerRef.current) clearTimeout(launchTimerRef.current);
      },
      [],
    );

    const launchGame = (path, title) => {
      if (launching) return;
      setLaunching({ path, title });
      launchTimerRef.current = setTimeout(() => navigateTo(path), 1050);
    };

    useEffect(() => {
      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          returnToWorkbench();
          return;
        }
        if (launching) return;
        if (event.key === "1")
          launchGame("/ai-fleet-defense", "正在接入零号防线");
        if (event.key === "2")
          launchGame("/ai-bullet-dodge", "正在进入飞行训练空域");
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [launching]);

    return h(
      "main",
      { className: "agh-page", "data-testid": "ai-token-games-page" },
      h("link", { rel: "stylesheet", href: STYLE_PATH }),
      h(
        "header",
        { className: "agh-header" },
        h(
          "div",
          null,
          h("small", null, "WEWORK TOKEN ARCADE"),
          h("h1", null, "AI Token 游戏场"),
          h("p", null, "执行中的 AI 任务，会在不同游戏中转化为不同能力。"),
        ),
        h(
          "div",
          { className: "agh-live" },
          h("i", null),
          h(
            "span",
            null,
            `${telemetry.activeSessions} 个任务 · ${formatNumber(
              telemetry.tokensPerSecond,
            )} token/s`,
          ),
        ),
      ),
      h(
        "section",
        { className: "agh-games" },
        gameCard(h, {
          eyebrow: "FLEET DEFENSE",
          title: "AI 舰队 · 零号防线",
          description:
            "操控旗舰守住三条航道。并行任务化身 AI 僚机，Token 输出增强射速、伤害与战术充能。",
          tags: ["180 秒", "塔防射击", "并行越多越强"],
          className: "agh-fleet",
          testId: "ai-token-games-fleet",
          shortcut: "1",
          onClick: () => launchGame("/ai-fleet-defense", "正在接入零号防线"),
          action: "进入零号防线",
        }),
        gameCard(h, {
          eyebrow: "BULLET DODGE",
          title: "是王牌就坚持 60 秒",
          description:
            "驾驶纸翼穿过逐渐加密的弹幕。Token 不降低难度，只会加快护盾、减速与清屏道具充能。",
          tags: ["60 秒", "弹幕躲避", "Token 加速道具"],
          className: "agh-dodge",
          testId: "ai-token-games-dodge",
          shortcut: "2",
          onClick: () => launchGame("/ai-bullet-dodge", "正在进入飞行训练空域"),
          action: "开始飞行训练",
        }),
      ),
      h(
        "footer",
        { className: "agh-footer" },
        h("span", null, "按 1 / 2，或点击游戏开始"),
        h(
          "button",
          { type: "button", onClick: returnToWorkbench },
          "← 返回工作台",
        ),
      ),
      launching
        ? h(
            "div",
            {
              className: "agh-transition",
              "data-testid": "ai-token-games-transition",
            },
            h("div", { className: "agh-door agh-door-left" }),
            h("div", { className: "agh-door agh-door-right" }),
            h(
              "div",
              { className: "agh-transition-status" },
              h("i", null),
              h("b", null, launching.title),
              h("small", null, "舱门闭合 // LINK ESTABLISHED"),
            ),
          )
        : null,
    );
  }

  return GameHubRoute;
}

function gameCard(h, options) {
  return h(
    "article",
    { className: `agh-card ${options.className}` },
    h(
      "div",
      { className: "agh-art" },
      h("div", { className: "agh-art-grid" }),
      h("div", { className: "agh-art-core" }),
      h("div", { className: "agh-art-wing agh-art-wing-one" }),
      h("div", { className: "agh-art-wing agh-art-wing-two" }),
    ),
    h(
      "div",
      { className: "agh-card-copy" },
      h("small", null, options.eyebrow),
      h(
        "div",
        { className: "agh-card-title" },
        h("h2", null, options.title),
        h("kbd", null, options.shortcut),
      ),
      h("p", null, options.description),
      h(
        "div",
        { className: "agh-tags" },
        options.tags.map((tag) => h("span", { key: tag }, tag)),
      ),
      h(
        "button",
        {
          type: "button",
          "data-testid": options.testId,
          onClick: options.onClick,
        },
        options.action,
        h("b", null, "→"),
      ),
    ),
  );
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

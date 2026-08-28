const PACKAGE_NAME = "@wegent/ai-fleet-defense";
const UNIT = "ai_fleet_defense";
const DESCRIPTOR = {
  version: 1,
  tables: ["scores", "dodge_scores"],
  has_global: false,
};

export async function loadDodgeLeaderboard() {
  const response = await storageFetch(
    `/units/${UNIT}/tables/dodge_scores/shared?package=${encodeURIComponent(PACKAGE_NAME)}`,
  );
  const body = await response.json();
  const rows = Array.isArray(body.records) ? body.records : [];
  return rows
    .sort(
      (left, right) =>
        Number(right.value?.score ?? 0) - Number(left.value?.score ?? 0),
    )
    .slice(0, 100);
}

export async function submitDodgeScore(game) {
  if (!backendConnection() || game.score <= 0) return;
  const currentResponse = await storageFetch(
    `/units/${UNIT}/load?package=${encodeURIComponent(PACKAGE_NAME)}`,
    {
      method: "POST",
      body: JSON.stringify(DESCRIPTOR),
    },
  );
  const current = await currentResponse.json();
  const bestScore = Number(current.tables?.dodge_scores?.best?.score ?? 0);
  if (bestScore >= game.score) return;
  await storageFetch(
    `/units/${UNIT}/tables/dodge_scores/records/best?package=${encodeURIComponent(PACKAGE_NAME)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        ...DESCRIPTOR,
        value: {
          score: game.score,
          survivedSeconds: Number(game.elapsed.toFixed(1)),
          grazes: game.grazes,
          remainingLives: Math.max(0, game.lives),
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
  if (!response.ok) throw new Error(`排行榜请求失败：HTTP ${response.status}`);
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

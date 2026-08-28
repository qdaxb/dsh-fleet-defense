export const DODGE_GAME_SECONDS = 60;

const PLAYER_SPEED = 48;
const HIT_RADIUS = 2.25;
const GRAZE_RADIUS = 5.4;
const MAX_BULLETS = 180;

export function createDodgeGame(running = false) {
  return {
    runId: crypto.randomUUID(),
    status: running ? "running" : "idle",
    elapsed: 0,
    player: { x: 50, y: 72 },
    lives: 3,
    energy: 0,
    score: 0,
    grazes: 0,
    spawnCooldown: 0.6,
    shieldTimer: 0,
    slowTimer: 0,
    invulnerableTimer: 0,
    nextId: 1,
    bullets: [],
    effects: [],
  };
}

export function advanceDodgeGame(game, input, telemetry, dt) {
  if (game.status !== "running") return game;

  const next = {
    ...game,
    player: { ...game.player },
    bullets: game.bullets.map((bullet) => ({ ...bullet })),
    effects: game.effects
      .map((effect) => ({ ...effect, age: effect.age + dt }))
      .filter((effect) => effect.age < 0.8),
    elapsed: Math.min(DODGE_GAME_SECONDS, game.elapsed + dt),
    spawnCooldown: game.spawnCooldown - dt,
    shieldTimer: Math.max(0, game.shieldTimer - dt),
    slowTimer: Math.max(0, game.slowTimer - dt),
    invulnerableTimer: Math.max(0, game.invulnerableTimer - dt),
    energy: Math.min(
      100,
      game.energy +
        dt * Math.max(1.6, Number(telemetry.ultimateChargePerSecond ?? 1.6)),
    ),
  };

  movePlayer(next.player, input, dt);
  useItem(next, input.item);
  spawnBullets(next);
  moveAndCollide(next, dt);

  next.score += dt * (100 + Math.min(180, next.elapsed * 3));
  if (next.lives <= 0 || next.elapsed >= DODGE_GAME_SECONDS) {
    next.status = "ended";
    next.score = Math.max(
      0,
      Math.round(
        next.score +
          next.grazes * 75 +
          next.lives * 1200 +
          (next.elapsed >= DODGE_GAME_SECONDS ? 5000 : 0),
      ),
    );
  }
  return next;
}

function movePlayer(player, input, dt) {
  if (input.pointer) {
    const follow = Math.min(1, dt * 14);
    player.x += (clamp(input.pointer.x, 4, 96) - player.x) * follow;
    player.y += (clamp(input.pointer.y, 6, 94) - player.y) * follow;
    return;
  }

  const horizontal = Number(input.right) - Number(input.left);
  const vertical = Number(input.down) - Number(input.up);
  const length = Math.hypot(horizontal, vertical) || 1;
  player.x = clamp(player.x + (horizontal / length) * PLAYER_SPEED * dt, 4, 96);
  player.y = clamp(player.y + (vertical / length) * PLAYER_SPEED * dt, 6, 94);
}

function useItem(game, item) {
  if (item === "shield" && game.energy >= 45) {
    game.energy -= 45;
    game.shieldTimer = Math.max(game.shieldTimer, 4);
    addEffect(game, "shield", game.player.x, game.player.y);
  }
  if (item === "slow" && game.energy >= 65) {
    game.energy -= 65;
    game.slowTimer = Math.max(game.slowTimer, 5);
    addEffect(game, "slow", game.player.x, game.player.y);
  }
  if (item === "pulse" && game.energy >= 100) {
    game.energy = 0;
    game.score += game.bullets.length * 12;
    game.bullets = [];
    addEffect(game, "pulse", game.player.x, game.player.y);
  }
}

function spawnBullets(game) {
  while (game.spawnCooldown <= 0 && game.bullets.length < MAX_BULLETS) {
    const count = game.elapsed >= 45 ? 3 : game.elapsed >= 25 ? 2 : 1;
    for (
      let index = 0;
      index < count && game.bullets.length < MAX_BULLETS;
      index += 1
    ) {
      game.bullets.push(createBullet(game, index));
    }
    game.spawnCooldown += Math.max(0.12, 0.48 - game.elapsed * 0.0055);
  }
}

function createBullet(game, index) {
  const edge = Math.floor(Math.random() * 4);
  const margin = 1.5;
  let x;
  let y;
  if (edge === 0) {
    x = 5 + Math.random() * 90;
    y = -margin;
  } else if (edge === 1) {
    x = 100 + margin;
    y = 5 + Math.random() * 90;
  } else if (edge === 2) {
    x = 5 + Math.random() * 90;
    y = 100 + margin;
  } else {
    x = -margin;
    y = 5 + Math.random() * 90;
  }

  const spread = (Math.random() - 0.5) * (0.28 + index * 0.08);
  const targetX = game.player.x + spread * 35;
  const targetY = game.player.y + spread * 35;
  const distance = Math.hypot(targetX - x, targetY - y) || 1;
  const speed = 13 + game.elapsed * 0.22 + Math.random() * 5;
  return {
    id: game.nextId++,
    x,
    y,
    vx: ((targetX - x) / distance) * speed,
    vy: ((targetY - y) / distance) * speed,
    radius: Math.random() < Math.min(0.3, game.elapsed / 140) ? 1.6 : 1.05,
    kind: Math.random() < 0.22 ? "orb" : "shot",
    grazed: false,
  };
}

function moveAndCollide(game, dt) {
  const speedScale = game.slowTimer > 0 ? 0.36 : 1;
  let hit = false;
  const surviving = [];

  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt * speedScale;
    bullet.y += bullet.vy * dt * speedScale;
    if (bullet.x < -5 || bullet.x > 105 || bullet.y < -5 || bullet.y > 105)
      continue;

    const distance = Math.hypot(
      bullet.x - game.player.x,
      bullet.y - game.player.y,
    );
    if (
      distance <= HIT_RADIUS + bullet.radius &&
      game.shieldTimer <= 0 &&
      game.invulnerableTimer <= 0
    ) {
      hit = true;
      addEffect(game, "hit", game.player.x, game.player.y);
      continue;
    }
    if (
      !bullet.grazed &&
      distance <= GRAZE_RADIUS + bullet.radius &&
      distance > HIT_RADIUS + bullet.radius
    ) {
      bullet.grazed = true;
      game.grazes += 1;
      game.score += 75;
      addEffect(game, "graze", bullet.x, bullet.y);
    }
    surviving.push(bullet);
  }

  game.bullets = surviving;
  if (hit) {
    game.lives -= 1;
    game.invulnerableTimer = 1.7;
  }
}

function addEffect(game, kind, x, y) {
  game.effects.push({
    id: `effect-${game.nextId++}`,
    kind,
    x,
    y,
    age: 0,
  });
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

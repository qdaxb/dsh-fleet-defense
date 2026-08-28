import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("./client.js", import.meta.url), "utf8");
const dodgeRoute = await readFile(
  new URL("./dodge/route.js", import.meta.url),
  "utf8",
);
const hubRoute = await readFile(
  new URL("./hub/route.js", import.meta.url),
  "utf8",
);
const hubStyles = await readFile(
  new URL("./hub/styles.css", import.meta.url),
  "utf8",
);

test("balances survival around a four-session fleet without a hard gate", () => {
  assert.match(client, /const RECOMMENDED_PARALLEL_UNITS = 4/);
  assert.match(client, /active \/ RECOMMENDED_PARALLEL_UNITS/);
  assert.match(client, /0\.88 - fleetReadiness \* 0\.38/);
  assert.match(client, /9 \+ fleetReadiness \* 18/);
  assert.match(client, /至少 4 个并发 AI 才能形成完整防线/);
  assert.doesNotMatch(client, /active < RECOMMENDED_PARALLEL_UNITS/);
});

test("enemy swarms actually close in with visible motion", () => {
  assert.match(
    client,
    /Math\.random\(\) < Math\.min\(0\.62, next\.elapsed \/ 260\)/,
  );
  assert.match(client, /\? 11\.5 \+ next\.elapsed \/ 55/);
  assert.match(client, /\? 7 \+ next\.elapsed \/ 90/);
  assert.match(client, /afd-enemy-wrap::before/);
  assert.match(
    client,
    /enemy\.x -= dt \* speed \* \(enemy\.elite \? 1\.1 : 1\) \* empSlow/,
  );
});

test("unlocks distinct enemy roles and late-game formations", () => {
  assert.match(client, /跃迁突袭舰/);
  assert.match(client, /棱镜护卫舰/);
  assert.match(client, /蜂群播种舰/);
  assert.match(client, /裂隙无人机/);
  assert.match(client, /next\.elapsed >= 150/);
  assert.match(client, /MAX_ACTIVE_ENEMIES/);
  assert.match(client, /enemy\.laneShiftCooldown <= 0/);
  assert.match(client, /target\.shield -= absorbed/);
  assert.match(client, /deployedDrones\.push/);
});

test("adds boss escorts and elite pressure after the boss phase", () => {
  assert.match(client, /createBoss\(next\)/);
  assert.match(client, /createEnemy\(next, "striker", 0, 99, false\)/);
  assert.match(client, /createEnemy\(next, "shield", 2, 99, false\)/);
  assert.match(client, /next\.elapsed >= 138/);
  assert.match(client, /enemy\.elite \? 1\.1 : 1/);
  assert.match(client, /enemy\.elite \? 1\.3 : 1/);
  assert.match(client, /hp: 1600/);
  assert.match(client, /MAX_ACTIVE_ENEMIES = 22/);
});

test("projectiles stop and deal damage when they physically reach an enemy", () => {
  assert.match(client, /const volleyDamage = damage \* synergy/);
  assert.match(client, /damage: volleyDamage \/ volleySize/);
  assert.match(client, /enemy\.x <= projectile\.x/);
  assert.match(client, /let remainingDamage = projectile\.damage/);
  assert.match(client, /target\.hp -= remainingDamage/);
  assert.match(client, /next\.projectiles = flyingProjectiles/);
  assert.doesNotMatch(client, /target\.hp -= damage \* synergy/);
});

test("turns every active wingman into a visible projectile emitter", () => {
  assert.match(
    client,
    /const wingmanCount = Math\.min\(5, Math\.floor\(active\)\)/,
  );
  assert.match(client, /const volleySize = 1 \+ wingmanCount/);
  assert.match(client, /emitter < volleySize/);
  assert.match(client, /WINGMAN_PROJECTILE_OFFSETS\[wingmanIndex\]/);
  assert.match(client, /source: emitter === 0 \? "flagship" : "wingman"/);
  assert.match(client, /afd-projectile-wingman/);
});

test("renders a distinct explosion for every projectile impact", () => {
  assert.match(client, /source: projectile\.source/);
  assert.match(client, /xOffset: projectile\.impactXOffset/);
  assert.match(client, /yOffset: projectile\.yOffset/);
  assert.match(client, /burst\.x \+ \(burst\.xOffset \?\? 0\)/);
  assert.match(client, /burst\.yOffset \?\? 0/);
  assert.match(client, /afd-impact-burst-wingman/);
});

test("shows a dedicated impact when an enemy breaches the core", () => {
  assert.match(client, /kind: "breach"/);
  assert.match(client, /afd-breach-burst/);
  assert.match(client, /@keyframes afd-breach/);
});

test("makes controls and AI firepower contribution explicit", () => {
  assert.match(client, /点击航道或按 W \/ S 上下移动/);
  assert.match(client, /每个执行中任务都会增强火力/);
  assert.match(client, /至少 4 并发才有稳定胜算/);
  assert.match(client, /Token \/ 秒/);
  assert.match(client, /data-testid": "ai-fleet-defense-ultimate"/);
});

test("always exposes a way back to the Wework workbench", () => {
  assert.match(client, /data-testid": "ai-fleet-defense-exit"/);
  assert.match(client, /data-testid": "ai-fleet-defense-exit-after"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /window\.history\.pushState/);
  assert.match(client, /new PopStateEvent\("popstate"\)/);
});

test("consumes the ultimate press inside the frame instead of losing it", () => {
  assert.match(client, /const ultimateRequested = input\.ultimate/);
  assert.match(client, /const tacticalRequested = input\.tactical/);
  assert.match(client, /input\.ultimate = false/);
  assert.match(client, /input\.tactical = null/);
  assert.match(client, /ultimate: ultimateRequested/);
  assert.match(client, /tactical: tacticalRequested/);
  assert.match(client, /setUltimateDeniedTick/);
  assert.match(client, /afd-ultimate-denied/);
});

test("starts or restarts the game when space is pressed on the overlay", () => {
  assert.match(client, /if \(current\.status !== "running"\)/);
  assert.match(client, /submittedScoreRef\.current = null/);
  assert.match(client, /setGame\(createGame\(true\)\)/);
  assert.match(client, /h\("b", null, "SPACE"\)/);
});

test("offers tactical items as alternatives to saving for the ultimate", () => {
  assert.match(client, /EMP 脉冲/);
  assert.match(client, /维修蜂群/);
  assert.match(client, /input\.tactical === "emp"/);
  assert.match(client, /next\.ultimate -= 40/);
  assert.match(client, /input\.tactical === "repair"/);
  assert.match(client, /next\.ultimate -= 55/);
  assert.match(client, /next\.hp = Math\.min\(100, next\.hp \+ 28\)/);
  assert.match(client, /next\.barrierTimer > 0 \? 0\.6 : 1/);
});

test("makes the nuclear blast deal bounded damage instead of deleting the field", () => {
  assert.match(client, /裂隙核爆/);
  assert.match(client, /110 \+ Math\.min\(90, Math\.sqrt\(tps\) \* 5\)/);
  assert.match(
    client,
    /enemy\.boss[\s\S]*Math\.min\(240, blastDamage \* 0\.75\)/,
  );
  assert.match(client, /enemy\.shield -= absorbed/);
  assert.match(client, /enemy\.hp -= remainingDamage/);
  assert.doesNotMatch(client, /enemy\.shield = 0/);
  assert.doesNotMatch(client, /enemy\.hp -= 230 \+ tps \* 0\.85/);
});

test("keeps the ultimate progress bar synchronized with frame state", () => {
  assert.match(client, /width: `\$\{Math\.min\(100, game\.ultimate\)\}%`/);
  assert.doesNotMatch(client, /\.afd-charge-track span\{[^}]*transition:width/);
});

test("uses the packaged cinematic battlefield asset", () => {
  assert.match(
    client,
    /\/ai-fleet-defense\/assets\/neural-rift-battlefield\.png/,
  );
});

test("uses a dedicated shield icon for the fleet route", () => {
  assert.equal((client.match(/icon: "shield"/g) ?? []).length, 1);
  assert.doesNotMatch(client, /icon: "applications"/);
});

test("registers both games behind one game hub sidebar entry", () => {
  assert.match(client, /import\("\/ai-fleet-defense\/hub\/route\.js"\)/);
  assert.match(client, /import\("\/ai-fleet-defense\/dodge\/route\.js"\)/);
  assert.match(client, /path: "\/ai-token-games"/);
  assert.match(client, /path: "\/ai-bullet-dodge"/);
  assert.match(client, /label: "AI Token 游戏"/);
  assert.equal(
    (client.match(/ctx\.slots\.inject\("wework\.sidebar\.navigation"/g) ?? [])
      .length,
    1,
  );
  assert.match(client, /icon: "gamepad-2"/);
  assert.match(client, /icon: "plane"/);
  assert.match(client, /testId: "ai-token-games-button"/);
});

test("closes the hangar doors before the hub launches a game", () => {
  assert.match(hubRoute, /setTimeout\(\(\) => navigateTo\(path\), 1050\)/);
  assert.match(hubRoute, /ai-token-games-transition/);
  assert.match(hubRoute, /agh-door agh-door-left/);
  assert.match(hubRoute, /agh-door agh-door-right/);
  assert.match(hubStyles, /@keyframes agh-door-left/);
  assert.match(hubStyles, /@keyframes agh-door-right/);
});

test("lets escape leave the game hub", () => {
  assert.match(hubRoute, /event\.key === "Escape"/);
  assert.match(hubRoute, /returnToWorkbench\(\)/);
});

test("lets number keys select games from the hub", () => {
  assert.match(hubRoute, /event\.key === "1"/);
  assert.match(
    hubRoute,
    /launchGame\("\/ai-fleet-defense", "正在接入零号防线"\)/,
  );
  assert.match(hubRoute, /event\.key === "2"/);
  assert.match(
    hubRoute,
    /launchGame\("\/ai-bullet-dodge", "正在进入飞行训练空域"\)/,
  );
  assert.match(hubRoute, /shortcut: "1"/);
  assert.match(hubRoute, /shortcut: "2"/);
  assert.match(hubRoute, /h\("kbd", null, options\.shortcut\)/);
});

test("uses space to start both games", () => {
  assert.match(dodgeRoute, /event\.key === " "/);
  assert.match(dodgeRoute, /gameRef\.current\.status === "running"/);
  assert.match(dodgeRoute, /else restartGame\(\)/);
  assert.match(dodgeRoute, /h\("b", null, "SPACE"\)/);
  assert.doesNotMatch(dodgeRoute, /event\.key === "Enter"/);
});

test("keeps bullet dodge running until lives are exhausted", () => {
  assert.doesNotMatch(dodgeRoute, /DODGE_GAME_SECONDS/);
  assert.match(dodgeRoute, /h\("h1", null, "是王牌就坚持下去"\)/);
  assert.match(dodgeRoute, /hud\("MODE", "ENDLESS"\)/);
});

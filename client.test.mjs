import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("./client.js", import.meta.url), "utf8");

test("keeps a complete baseline weapon when no AI session is active", () => {
  assert.match(client, /const fireInterval = Math\.max\(0\.1, 0\.62/);
  assert.match(client, /const damage = 16 \+ Math\.sqrt\(tps\)/);
  assert.match(client, /旗舰基础火力在线，可立即单舰出击/);
});

test("enemy swarms actually close in with visible motion", () => {
  assert.match(client, /Math\.random\(\) < Math\.min\(0\.62, next\.elapsed \/ 260\)/);
  assert.match(client, /: 11\.5 \+ next\.elapsed \/ 55/);
  assert.match(client, /\? 7 \+ next\.elapsed \/ 90/);
  assert.match(client, /afd-enemy-wrap::before/);
  assert.match(client, /enemy\.x -= dt \* speed/);
});

test("makes controls and AI firepower contribution explicit", () => {
  assert.match(client, /点击航道或按 W \/ S 上下移动/);
  assert.match(client, /执行中任务会成为僚机/);
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
  assert.match(client, /input\.ultimate = false/);
  assert.match(client, /{ \.\.\.input, ultimate: ultimateRequested }/);
  assert.match(client, /setUltimateDeniedTick/);
  assert.match(client, /afd-ultimate-denied/);
});

test("uses the packaged cinematic battlefield asset", () => {
  assert.match(
    client,
    /\/ai-fleet-defense\/assets\/neural-rift-battlefield\.png/,
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("./client.js", import.meta.url), "utf8");

test("keeps a complete baseline weapon when no AI session is active", () => {
  assert.match(client, /const fireInterval = Math\.max\(0\.1, 0\.62/);
  assert.match(client, /const damage = 16 \+ Math\.sqrt\(tps\)/);
  assert.match(client, /旗舰基础火力在线，可立即单舰出击/);
});

test("makes controls and AI firepower contribution explicit", () => {
  assert.match(client, /点击航道或按 W \/ S 上下移动/);
  assert.match(client, /执行中任务会成为僚机/);
  assert.match(client, /Token \/ 秒/);
  assert.match(client, /data-testid": "ai-fleet-defense-ultimate"/);
});

test("uses the packaged cinematic battlefield asset", () => {
  assert.match(
    client,
    /\/ai-fleet-defense\/assets\/neural-rift-battlefield\.png/,
  );
});

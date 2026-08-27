# AI 舰队防线

这是一个独立的标准 DSH dual-face 插件：

- Host 半边监听官方 `session/event`，从 `assistant/chunk` 的 `usage` 事件计算每个 Session 的实时 token/s。
- Client 半边通过 `wework.route` 与 `wework.sidebar.navigation` 注册 Wework 游戏页面。
- 游戏结束后，Client 使用 Wegent 的通用 DSH 插件存储 API 保存共享最佳分数并读取 Backend 范围内排行榜。

## 游戏规则

- 每个处于 turn 中的 Session 都是一架僚机。
- 总 token/s 提升自动射击频率与伤害。
- 2–5 个并行 Session 提供有上限、递减的协同倍率。
- token 不直接换算分数；分数来自击杀、生存时间、连击、Boss 和剩余护盾。
- 一局 180 秒，120 秒时出现 Boss。

## 本地校验

```bash
npm test
```

在 Wework 的 DSH 插件管理中使用本目录作为本地插件源，校验并重启核心插件运行时后即可从侧边栏打开。

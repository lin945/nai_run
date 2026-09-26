# 奶龙快跑

第三人称 3D 网页跑酷游戏，使用 TypeScript、Three.js 和 Vite。游戏逻辑在浏览器执行，构建产物可由 Cloudflare Workers Static Assets 发布。

## 本地运行

```powershell
npm install
npm run dev
```

打开终端输出的本地地址。电脑用 `←/→` 或 `A/D` 换道、`↑/W/空格` 跳跃、`↓/S` 翻滚，`P/Esc` 暂停；手机在画面中向对应方向滑动。

```powershell
npm test
npm run build
```

启动开发服务器后可运行 `npm run smoke`。该脚本用本机 Chrome 检查桌面和手机视口的开始、动作、暂停、失败与重开，截图写入被忽略的 `log/`。设置 `NAI_RUN_URL` 可对 Wrangler 本地地址运行同一检查。

`npm run cf:dev` 可用 Wrangler 本地预览构建结果。`npm run cf:deploy` 需 Cloudflare 授权和 `bilibili.asia` Zone 权限；正式目标域名是 `nai.bilibili.asia`。GitHub 私有仓库和 Cloudflare 授权由用户准备后再接入。

设计与任务见 [docs/design.md](docs/design.md)、[docs/tasks.md](docs/tasks.md)。`res/` 是角色参考资料，`log/` 中的本地日志不会加入 Git。

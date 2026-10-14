# 奶娃快跑 · Naiwa Run

第三人称 3D 网页跑酷游戏。操控奶娃在城市街道中换道、跳跃和翻滚，避开障碍，收集星星与道具。使用 TypeScript、Three.js 和 Vite，浏览器端运行，无需业务后端或服务密钥。

## 玩法

- 7 种障碍：车辆、对手、矮路障、横梁、尖刺、货箱和闸门。车辆与对手需要换道；矮路障、尖刺和货箱可以跳过；横梁和闸门需要在地面翻滚通过。
- 随距离提升速度与障碍密度，220 米后可能出现三车道动作挑战，动作挑战不会连续生成。
- 星星每颗加 10 分，总分为距离米数取整加星星奖励。冲刺持续 5 秒，磁铁持续 8 秒；冲刺期间撞到障碍仍会失败。
- 连续城市街景，建筑离开镜头后回收。支持暂停、重开、浏览器本地最高分与静音偏好。

| 操作 | 电脑 | 手机 |
| --- | --- | --- |
| 换道 | ← / →、A / D | 左 / 右滑动 |
| 跳跃 | ↑、W、空格 | 向上滑动 |
| 翻滚 | ↓、S | 向下滑动 |
| 暂停 / 继续 | P、Esc 或按钮 | 界面按钮 |

## 本地运行

需要 Node.js 22.12+（建议 Node.js 24 LTS）、npm 和支持 WebGL 2 的现代浏览器。

```bash
npm ci
npm run dev
```

打开终端显示的地址，默认 `http://localhost:5173/`。`localhost` 仅指运行服务的机器：远程开发环境需要端口转发或预览地址。手机与开发机器处于同一局域网时，可使用终端输出的局域网地址，防火墙需允许对应端口。

## 构建与检查

```bash
npm test
npm run build
npm run preview
```

构建会先进行 TypeScript 类型检查，输出到 `dist/`。构建预览地址通常为 `http://localhost:4173/`。

启动开发服务器后，在另一个终端运行浏览器检查：

```bash
npx playwright install chromium
npm run smoke
node script/performance-regression.mjs
```

默认使用 Playwright Chromium；可通过 `NAI_RUN_BROWSER_CHANNEL=chrome` 使用本机 Chrome，或用 `NAI_RUN_BROWSER_PATH` 指定浏览器路径。`NAI_RUN_URL` 指定待检查地址。详见 [脚本说明](script/README.md)。截图和报告写入被忽略的 `log/`。

## 部署

`dist/` 可发布到任意支持静态网页的服务器。项目也提供 Cloudflare Workers Static Assets 配置，在自己的账号完成 Wrangler 登录或提供环境变量凭据后执行：

```bash
npm run cf:dev
npm run cf:deploy
```

默认配置没有绑定个人域名。部署前检查 `wrangler.jsonc` 中的 Worker 名称；需要自定义域名时，配置自己拥有的域名路由。凭据只放在本机环境变量或部署平台 Secret 中，不提交 Git，也不使用 `VITE_*` 保存秘密，后者会被打包到浏览器。

## 项目结构

```text
src/game/       游戏循环、输入、角色、街景、障碍与规则测试
src/ui/         HUD、开始页、暂停与结算
src/platform/   浏览器本地成绩与偏好
src/styles.css  响应式样式
public/         图标与静态响应头
res/            角色图片和参考素材，授权状态见素材说明
script/         浏览器冒烟与性能行为回归检查
docs/           设计、实现状态与开源准备记录
```

调参主要在 `config.ts` 和 `rules.ts`；街景与障碍外观在 `World.ts`，角色网格和动作在 `Player.ts`。

## 隐私与运行边界

源码没有账号系统、在线排行榜、广告、第三方统计脚本或成绩上传逻辑。最高分和声音偏好保存在 `localStorage` 的 `nai-run-save-v1` 中，清除站点数据会重置它们。部署平台可能独立注入统计脚本或记录请求日志，需由部署者自行配置。

浏览器检查包含桌面与手机视口模拟，不能替代 Android / iPhone 真机性能验证。历史性能报告描述旧版本，不能作为当前街景版本的帧率承诺。

## 开源与贡献

源代码与项目文档采用 [MIT 许可证](LICENSE)。项目所有者已确认角色素材具有公开分发授权；图片、角色形象与商标的使用范围见 [素材说明](docs/assets.md)，不自动纳入代码的 MIT 授权。

请阅读 [素材与第三方说明](docs/assets.md)、[开源准备检查](docs/open-source-readiness.md) 和 [贡献指南](CONTRIBUTING.md)。实现说明见 [设计文档](docs/design.md)，进度见 [任务清单](docs/tasks.md)。

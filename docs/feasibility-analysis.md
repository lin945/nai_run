# 奶龙快跑：3D 网页跑酷游戏可行性分析

> 版本：2026-09-26。本文记录立项时的可行性与范围判断；当前本地实现进度见 [实施任务](./tasks.md)。远端仓库和正式部署仍待接入。

## 1. 结论与前提

**结论：可行。** 浏览器负责实时 3D 渲染和游戏循环，Cloudflare Workers Static Assets 负责分发构建后的网页、模型与音效；未来如需在线排行榜，再增加同域 Worker API 和 D1 数据库。游戏不需要在 Worker 中逐帧运行。[Cloudflare 静态资源文档](https://developers.cloudflare.com/workers/static-assets/)、[D1 文档](https://developers.cloudflare.com/d1/)

首版按**单人、三条并排车道、无限向前跑**设计。支持 Windows/macOS 的现代桌面浏览器及 Android/iOS 的现代手机浏览器；电脑使用键盘，手机使用滑动。最高分暂存本机。这里的“三条车道”是对“几个不同的赛道、左右切换”的实施假设，数量可配置；不同场景主题不列入首版必需项。

最大的实际难点是角色资源，而非 Cloudflare 部署：现有 `res/` 为 PNG/WebP 参考图和精灵图，没有可从背后观看、能连续跑跳翻滚的 3D 骨骼模型。若要满足“3D 第三人称”且保留角色辨识度，需要制作并绑定 3D 模型，或先用程序化 3D 模型完成玩法验证。2D 精灵图不能直接变成满足该要求的 3D 动画角色。[Three.js glTF 模型和动画加载文档](https://threejs.org/docs/pages/GLTFLoader.html)

## 2. 立项时的本地项目现状

| 项目 | 已核实情况 | 对实施的影响 |
| --- | --- | --- |
| 代码 | 当前没有游戏源码、构建配置或 Worker 配置 | 可以从简洁结构起步 |
| 角色参考 | `res/` 有 12 张 PNG/WebP；包含待机、奔跑、跳跃、方向和表情等参考 | 可指导造型与 UI；缺少背面视角、完整翻滚动作和 3D 模型 |
| Git | 本地仓库尚无提交、未设置远端；参考图与 IDE 文件已经在暂存区 | 后续建私有仓库时需核对现有暂存内容，不覆盖原文件 |
| 域名 | 已确认目标为 `https://nai.bilibili.asia/`；本机 DNS 查询时仍返回“名称不存在” | 绑定前需确认 `bilibili.asia` 的 Cloudflare Zone 管理权限；不改动 `map.bilibili.asia` |

目录约定：`docs/` 存文档；`log/` 存本地运行、构建或排错日志，目录保留但内容不提交；`script/` 存辅助脚本；`res/` 保留原始参考素材。正式上线使用的压缩模型和贴图放在构建资源目录，避免把所有参考图随游戏加载。

## 3. 技术选型

| 方案 | 评价 |
| --- | --- |
| **TypeScript + Vite + Three.js + HTML/CSS HUD（推荐）** | 运行时代码少，3D 场景与游戏循环直接可控，Vite 输出静态文件，适合 Workers Static Assets；UI 用 DOM 实现，便于适配手机和电脑。Three.js 的 WebGLRenderer 当前需要 WebGL 2。[Three.js 文档](https://threejs.org/docs/pages/WebGLRenderer.html) |
| React + React Three Fiber | 对复杂菜单、商店和大量声明式 UI 有益；首版核心是高频游戏循环，引入 React 会增加依赖和状态边界，暂不需要。已有浏览器跑酷参考项目使用此栈。[Bull Rush](https://github.com/winsznx/bull-rush) |
| Godot Web 导出 | 可做 3D 游戏，但 Web 导出依赖 WebAssembly/WebGL 2，还涉及较大的引擎包与导出配置；对于当前要直接部署到 Workers 的轻量网页游戏，首版成本较高。[Godot Web 导出文档](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) |

### 后端选型与预留边界

**当前：无业务后端。** Worker 只发布 Vite 构建出的静态游戏；浏览器本地存最高分。不创建空 API、D1 数据库或后端框架，避免无功能代码增加部署与维护成本。

**未来增加排行榜时：同一个 Cloudflare Worker（TypeScript）+ D1。** Worker 用原生 `fetch`/`Request`/`Response` 处理少量 API，D1 用 SQL 保存玩家成绩；建议接口为 `GET /api/leaderboard` 查询榜单、`POST /api/runs` 提交一局结果。静态资源仍走资源分发，只让 `/api/*` 先进入 Worker。D1 支持 Worker 绑定和 SQL migration；如果接口规模以后明显增长，再考虑引入 Hono，不在首版预装。[Workers 静态资源路由](https://developers.cloudflare.com/workers/static-assets/binding/)、[D1 Worker API](https://developers.cloudflare.com/d1/worker-api/)、[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

**代码边界：** `src/game` 负责输入、状态、生成、碰撞、分数与渲染；`src/ui` 负责开始页、HUD、结算和响应式控件；`src/platform` 集中管理本地成绩读写。未来 `src/platform` 增加 API 客户端，`worker/` 增加接口与数据库迁移，游戏循环不迁入 Worker。在线排行榜仍需另行设计身份、限流和成绩校验；仅接收客户端上报数字会被篡改。

## 4. 首版玩法与实现边界

| 功能 | 建议实现与判定 |
| --- | --- |
| 视角与移动 | 摄像机固定在角色后上方平滑跟随；角色始终向前，左右一次切换一条车道，不能越界。将场景段向角色移动可避免长距离运行时坐标精度下降。 |
| 输入 | PC：←/→ 或 A/D 换道，↑/空格跳跃，↓/S 翻滚；手机：左/右/上/下滑。暂停、重新开始有可触控按钮。输入统一转成游戏动作，避免两套规则。 |
| 动作 | 至少有待机、奔跑、跳跃、翻滚、碰撞/失败；切道需有身体倾斜或过渡。动作触发与碰撞体的高度/位置同步，防止视觉穿过但判撞。 |
| 障碍 | 车辆、路上角色作为碰撞即结束的障碍；低路障可跳过，高横杆可翻滚穿过；同一类障碍使用稳定的视觉提示。移动障碍的判定基于相对位置。 |
| 星星与道具 | 星星碰到后加分；吸铁石在限定时间内吸取附近星星；快速奔跑在限定时间内增加移动速度。按“撞到障碍物结束”理解，加速期间仍会撞败。 |
| 分数 | 建议 `分数 = 距离米数取整 + 星星数 × 固定奖励`；HUD 同时显示距离、星星与总分；本地最高分持久化。具体奖励数值进统一配置，后续可调。 |
| 随机性 | 以固定长度路段生成并回收对象；生成时检查至少存在一条在当前速度与动作时长下可到达的安全路径，避免随机出三道全堵的死局。开发态可记录随机种子复现问题。 |

首版不包含多人实时竞速、账号、云端排行、付费系统或场景编辑器。未来扩展新的障碍、地图主题和排行榜时，应复用现有车道、生成与成绩接口。

## 5. 资源制作可行性

1. **玩法原型：** 先用低面数 3D 几何体构建角色占位、车辆、路障和赛道，验证视角、手感、碰撞、公平性与手机帧率。
2. **正式角色：** 根据 `res/` 制作角色的正、侧、背三视图，再建模、绑定骨骼，输出含跑、跳、翻滚、失败等动画片段的 `.glb`；必要时可先使用程序化骨架动画。Three.js 可读取 glTF 模型与动画片段。[GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)、[AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
3. **生图适用范围：** 可生成赛道环境概念图、贴图、天空背景、UI 插画等位图；生图本身不能保证产出可直接运行的、已绑定动作的 3D 角色。资源生产应记录来源，并在公开部署前确认角色形象和附加素材的使用授权。
4. **体积控制：** 模型与纹理需压缩并按需加载。Cloudflare 当前单个 Static Asset 上限为 **25 MiB**；大型素材要拆分或另行评估存储方式。[Workers 限额](https://developers.cloudflare.com/workers/platform/limits/)

## 6. 双端兼容与性能目标

- **界面：** 手机竖屏优先，横屏及电脑宽屏也能操作；HUD、暂停和结算按安全区域和屏幕尺寸排布。触摸滑动只作用于游戏区域，避免与网页滚动冲突。
- **能力检测：** 启动前检查 WebGL 2；不可用时展示明确提示，不显示空白画布。[Three.js 检测工具](https://threejs.org/docs/pages/WebGL.html)
- **性能措施：** 复用路段与障碍对象、批量渲染星星、限制可见距离和粒子数，按设备性能降低像素比与阴影质量；浏览器标签切后台时暂停游戏。移动端应重点控制像素填充和绘制调用。[MDN WebGL 性能建议](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- **验收目标：** 确定测试机型后，在至少一台主流 Android 手机、一台 iPhone 和一台电脑上验证；目标为手机稳定约 30 FPS、电脑约 60 FPS，连续跑 10 分钟无明显卡顿或内存持续增长。数值是工程目标，需以实际设备实测为准。

## 7. 推荐项目结构

```text
docs/                    需求、设计、测试与部署文档
log/                     本地日志；仅保留忽略规则，日志文件不入库
script/                  辅助脚本（如资源检查、构建检查）
res/                     现有原始参考图，不作为运行时资源直接全量加载
public/assets/           已确认可发布的模型、纹理、音效
src/
  main.ts                应用入口
  game/                  游戏循环、玩家动作、车道、生成、碰撞、分数
  ui/                    HUD、菜单、结算、响应式输入提示
  platform/              本地成绩存储；未来增加在线成绩 API 客户端
  styles.css             界面样式
worker/                  未来的 TypeScript 排行榜 API；首版无需创建
wrangler.jsonc           Workers 静态资源与域名配置（实施时创建）
```

保持单一游戏状态源；每个模块只承担一类职责。随机生成、碰撞和计分规则应可脱离 Three.js 场景做单元验证；渲染帧更新与 UI 更新分开，避免每帧改动 DOM。目录和文件只随实际功能落地，不提前生成空框架。

## 8. GitHub 与 Cloudflare 发布路径

1. 完成可运行游戏后，核对当前暂存文件与素材授权，再创建 GitHub **私有仓库**并推送。当前本地尚无远端，不能把已推送当作既成事实。
2. Vite 构建产物放入 `dist/`，由 Workers Static Assets 分发；单页游戏按 SPA 路由配置。可先用 `workers.dev` 验证，再绑定正式域名。[Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[SPA 路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
3. 可连接 GitHub 仓库使用 Workers Builds，在选定分支提交后自动构建和部署；Cloudflare GitHub App 仅授权目标仓库。[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)、[GitHub 集成](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
4. 正式域名已确认为 `nai.bilibili.asia`。若 `bilibili.asia` 在可操作的 Cloudflare Zone 内，可作为 Worker Custom Domain 绑定；Cloudflare 会创建对应 DNS 与证书。当前本机尚查不到 `nai` 的 DNS 记录，部署时以实际绑定和 HTTPS 访问验证为准；`map.bilibili.asia` 不在本项目操作范围。[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## 9. 开源实现参考

| 项目 | 可参考之处 | 使用边界 |
| --- | --- | --- |
| [Open Runner](https://github.com/CollinEMac/open-runner) | Three.js 无限地形、收集物、敌人与移动端性能设置 | 仓库有 MIT LICENSE；玩法与结构可参考，角色/美术仍需自行制作 |
| [Bull Rush](https://github.com/winsznx/bull-rush) | 浏览器 3D 跑酷与独立成绩 API 的组织方式 | 仓库有 MIT LICENSE，但其链上经济和独立 Redis/Postgres 后端超出首版范围 |
| [slava-railroad-surfer](https://github.com/alksandr/slava-railroad-surfer) | 三车道、跳跃/翻滚、随机路段可通行性检查、对象池的设计思路 | 仓库页面未见 LICENSE；仅作设计参考，不复制代码或资源 |

## 10. 主要风险、门槛与实施顺序

| 风险或待确认项 | 影响 | 处理建议 |
| --- | --- | --- |
| 缺 3D 角色模型、背面和翻滚动作 | 直接影响“真实 3D 第三人称”目标 | 先做几何体原型，随后把角色建模与动作验收设为独立里程碑 |
| 随机障碍可能不可通行 | 影响游戏公平性 | 生成前验证安全路径，保留可复现随机种子 |
| 手机 GPU 与浏览器差异 | 影响帧率和可玩性 | 早期真机测试，分级画质与对象复用 |
| 角色形象和素材的公开发布权限 | 影响公开网站发布 | 上线前确认使用权及素材来源；私有源码仓库不等于网站私有 |
| `nai.bilibili.asia` 当前未解析 | 影响最终域名绑定 | 目标域名已确认；发布时核对 Zone 管理权、Custom Domain 绑定、DNS 与 HTTPS |
| 后续排行榜信任边界 | 客户端分数易伪造 | 在线榜单阶段增加账号/会话、频率限制和成绩校验；首版只做本地成绩 |

**建议顺序：**

1. 先完成三车道灰盒原型与 PC/手机输入，验证连续跑、跳跃、翻滚、碰撞和必有可行路径。
2. 接入角色 3D 模型与五类基础动作，制作车辆、路障、角色障碍、星星和两种道具；调好手感与计分。
3. 做双端真机性能测试与资源优化，检查可发布素材，完成私有仓库、Workers 部署和域名绑定。

**首版完成标准：** 手机与电脑都能从开始页完成一局；三条车道可切换；跳跃和翻滚有对应动作及正确碰撞体；障碍、车辆和角色随机出现但保有可行路线；星星、加速和吸铁石有效；距离与总分持续增长；撞障碍进入结算并可重开；构建成功且正式域名访问通过实际浏览器验证。

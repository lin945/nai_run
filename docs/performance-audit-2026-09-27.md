# 奶娃快跑网站性能检测

检测日期：2026-09-27。对象：当时部署的游戏站点（个人域名已从公开文档移除）。检测版本：`c3b55a7`，线上主资源 `/assets/index-Cb-FMiMO.js`。本次为检测，未修改或重新发布游戏代码。本文是历史报告，数值不代表当前街景版本的性能。

## 结论

桌面加载表现良好，三次 Lighthouse 性能评分均为 **99**。手机模拟评分 **80–82**，中位数 **81**；主要内容显示时间 LCP 为 **3.22 秒**，主线程阻塞时间 TBT 为 **382 毫秒**，弱网与较慢 CPU 下仍有改善空间。

本机 Radeon 780M 上，桌面游戏约 **58.82 FPS**，手机视口约 **60 FPS**。本次确认了两个具体问题：**首次开局同步创建音频上下文导致明显停顿**；**暂停后仍持续渲染完整 3D 场景**。手机视口仍使用本机 GPU，不能据此判断真实 Android/iPhone 的帧率、发热或续航。

## 测试环境与方法

| 项目 | 本次设置 |
| --- | --- |
| 浏览器 | Windows Chrome 153.0.8010.53，headless |
| 渲染 | 实测 ANGLE / AMD Radeon 780M / Direct3D 11，硬件 WebGL 2 |
| Lighthouse | 13.5.0；桌面、手机各 3 次，串行执行，结果取中位数 |
| 桌面 Lighthouse | 1350×940；模拟 RTT 40 ms、10,240 Kbps、CPU 1 倍 |
| 手机 Lighthouse | 412×823；模拟 RTT 150 ms、1,638.4 Kbps、CPU 4 倍放慢 |
| 普通浏览器加载 | 本机实际网络、不额外限速；1280×800 与 390×844，各 3 次冷加载和同上下文刷新 |
| 运行采样 | 首页约 4 秒、运行/失败重开约 20 秒、暂停约 4 秒；使用 requestAnimationFrame 间隔和 CDP 指标 |
| 绘制统计 | 在隔离测试浏览器中统计 WebGL 2 draw 调用，包含阴影 pass；不是 Three.js 单次主场景 render 的计数 |
| Cloudflare 访问节点 | 本次返回的 CF-Ray 后缀为 SIN；不能代表其他地区和运营商的访问情况 |

Lighthouse 使用模拟网络/CPU 推导指标，与本机不限制速度的直接加载数据含义不同。正式 Core Web Vitals 合格情况应看真实用户分组的 P75；Lighthouse 导航测试使用 TBT，不能用它替代真实 INP。[Lighthouse 模拟方式](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)、[Web Vitals 定义与实验室边界](https://web.dev/articles/vitals)

## 1. Lighthouse 加载指标

| 指标 | 桌面中位数 | 手机模拟中位数 | 手机三次范围 |
| --- | ---: | ---: | ---: |
| 性能评分 | **99/100** | **81/100** | 80–82 |
| FCP 首次内容绘制 | 0.660 s | 2.248 s | 2.236–2.395 s |
| LCP 最大内容绘制 | 0.836 s | 3.223 s | 3.203–3.367 s |
| TBT 总阻塞时间 | 74 ms | 382 ms | 377–407 ms |
| CLS 布局偏移 | 0 | 0 | 0 |
| Speed Index | 0.925 s | 2.248 s | 2.236–2.395 s |
| 首次总传输量 | 约 330 KiB | 约 330 KiB | 基本稳定 |

LCP 的良好参考线为 2.5 秒，CLS 为 0.1。本次手机模拟 LCP 高于良好线；页面布局稳定。LCP 命中的是开始界面的角色图片，不能把该值直接解释为 3D 游戏已经完全可玩。[官方指标说明](https://web.dev/articles/vitals)

### 本机实际网络下的加载

下表没有 CPU/带宽放慢，手机栏仅改变视口与触摸能力。

| 指标中位数 | 桌面冷加载 | 桌面刷新 | 手机视口冷加载 | 手机视口刷新 |
| --- | ---: | ---: | ---: | ---: |
| TTFB（包含导航连接过程） | 153 ms | 90 ms | 137 ms | 65 ms |
| FCP | 592 ms | 348 ms | 544 ms | 328 ms |
| LCP | 704 ms | 348 ms | 564 ms | 328 ms |

冷加载代表新浏览器上下文，不代表 Cloudflare 边缘缓存或驱动缓存也是冷的。原始检测数据中还保存了“DOM/画布存在后两次 rAF”的探针，它可能早于真正的合成绘制，因此没有将该代理值当作“可玩时间”用于结论。

## 2. 已复现的问题与建议优先级

### P1：首次开启声音拖慢开始按钮响应

原始运行样本记录到首次点击约 **440 ms**。随后用四个全新 Chrome 进程，交替开启/关闭声音做了专项对照：

| 样本 | AudioContext 构造耗时 | 开始按钮 click 处理耗时 | 点击到下一次绘制 |
| --- | ---: | ---: | ---: |
| 声音开启 1 | 387.1 ms | 389.8 ms | 408 ms |
| 静音 1 | 无创建 | 1.1 ms | 56 ms |
| 声音开启 2 | 332.3 ms | 334.5 ms | 360 ms |
| 静音 2 | 无创建 | 0.9 ms | 80 ms |

源码路径：`src/game/Game.ts:113` 在开始事件中调用 `sound.play('start')`；`src/game/Sound.ts:18` 同步执行 `new AudioContext()`。本机证据确认主要阻塞来自音频上下文构造，不能把这次停顿归因于角色逐帧贴地计算。

建议：将开局画面更新和音频初始化拆开，使游戏能先显示反馈，再准备音频；已有音频上下文继续复用。实施时需验证 Chrome/Safari 的用户手势与音频恢复行为。上表是 Windows 本机结果，移动设备的初始化成本仍需实测；它也不是全站真实用户 INP。

### P2：首页、暂停和结算持续重绘，存在空闲开销

桌面暂停状态实测仍为 **60 FPS**，每帧 WebGL 绘制调用中位数 **567**，主线程 TaskDuration 占采样墙钟时间 **27.43%**。手机视口暂停时相应为 **60 FPS / 586 次 / 26.85%**。

源码 `src/game/Game.ts:203` 仅对逻辑 `step()` 判断运行状态，`Player.update()` 和 `renderer.render()` 仍每帧执行。建议暂停/结算在状态变化、窗口变化时绘制；首页若保留动态背景，可单独限制 3D 刷新频率。预期可明显减少空闲时的绘制提交，实际功耗与节省幅度需改后复测。这里的 CPU 百分比是**页面主线程忙碌时间占比**，不是整机 CPU 使用率，也没有测量电池耗电。

### P2：手机模拟首屏受图片与同步初始化影响

手机三轮 TBT 为 377–407 ms。导航审计将主要 CPU 工作归于主 JS 执行；源码显示首页 UI 和 Three.js 场景在启动时同步建立，但本次未单独量出各初始化步骤的占比。Lighthouse 手机第 1 次的未放慢原始 trace 显示：HTML 约 67 ms 返回，主 JS 约 284 ms 加载完成，角色图直到约 **445 ms** 才发起请求。该图由 `src/ui/Hud.ts:66` 动态插入。

角色图 `res/review.png` 为 **192×208、163,337 字节、6 帧 APNG**，约占首屏传输量的一半。Lighthouse 的图片审计给出约 153 KiB / LCP 750 ms 的估算节省，但这个估算不能作为保留六帧动画后的承诺。

建议先比较保留动画的压缩方案，或评估首屏先显示静态封面、动画稍后加载；同时分阶段建立 3D 资源，避免将整个场景初始化堆在一个主线程任务。图片提早发现/高优先级可以一并验证，但本次 Lighthouse 对单独的 LCP discovery 项没有给出非零收益，不把它独立列为收益确定的优化。

主 JS 还被初始页面覆盖率检测出约 **55 KiB** 传输量未用，工具估算约 150 ms 加载收益。这可能包含后续玩法才调用的 Three.js 功能，应先验证懒加载边界，不能直接删除。

### P3：带内容哈希的静态资源每次访问仍要校验

线上 HTML、JS、CSS、PNG 都返回 `Cache-Control: public, max-age=0, must-revalidate`。重复访问中 JS/CSS/PNG 返回 **304**；本次一个刷新样本中三次请求分别耗时约 **66 / 65 / 71 ms**。浏览器已复用文件内容，但还要等待网络校验。

建议只给 `/assets/*` 中带内容哈希的文件设置长期 immutable 缓存，HTML 保留校验。可通过 Vite 的 `public/_headers` 让 Workers Static Assets 使用以下规则；这是建议，尚未应用：

```text
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

收益主要是避免重复访问的校验请求；请求存在并行关系，不能把三次耗时直接相加当作首屏提速。[Cloudflare 静态资源响应头规则](https://developers.cloudflare.com/workers/static-assets/headers/)

## 3. 游戏运行情况

| 采样状态 | 桌面 | 手机视口（同一台 PC GPU） |
| --- | ---: | ---: |
| 游戏运行平均 rAF 频率 | 58.82 FPS | 60.00 FPS |
| 运行帧间隔 P95 | 16.9 ms | 16.9 ms |
| 运行帧间隔 >33.34 ms 占比 | 0.09% | 0% |
| 运行每帧 WebGL 提交中位数（含阴影） | 596 | 580 |
| 运行/重开窗口主线程忙碌时间占比 | 29.16% | 27.56% |
| 暂停每帧 WebGL 提交中位数 | 567 | 586 |

这是浏览器帧回调间隔，并非 GPU 硬件逐帧计时；绘制计数探针有少量自身开销。采样包含多次短局，桌面重开 4 次、手机视口 3 次，不是十分钟连续耐久测试。短采样 JS 堆约 7–16 MiB 波动并发生回收，尚不能据此证明长期无泄漏，也没有测量 GPU 显存。

源码构建计数显示初始化场景约 **478 个 Mesh、65,316 个三角形、444 个投影对象**，其中角色约 33,040 个三角形（含隐藏磁铁环）。这些是场景对象总量，实际可见对象和阴影 pass 会影响提交数。

当前电脑的持续帧率基本稳定，所以未将网格数量直接判定为已发生的 GPU 瓶颈。真实手机若达不到目标帧率，再优先合并/实例化车道线、树木和建筑窗户，减少远景阴影。`World.addRow()` 会在游戏帧中创建新几何并在离场时释放，存在周期性分配风险，但本次尚未将某个掉帧直接定位到生成路段。

`Player.alignToGround()` 每帧扫描约 4,969 个非球形顶点。单独 Node 预热测试约 0.022 ms/次，不包括浏览器和 GPU；现有证据不支持把它当成本轮主要瓶颈。HUD 已有值变化缓存，建议保留。

## 4. 网络、真实用户采集与其他检查

- HTTPS 和全部首屏资源请求正常，无页面 JavaScript 错误记录；检测的是当前部署资源 `index-Cb-FMiMO.js`。
- 本次同源资源使用 HTTP/3，JS/CSS/HTML 返回 zstd 压缩，Cloudflare 缓存状态为 HIT。没有观察到“未压缩主 JS”或“CDN 未命中”的问题。
- 冷加载总传输约 330 KiB：主 JS 约 154 KiB、角色图约 160 KiB、CSS 约 3.7 KiB，Cloudflare beacon 约 10 KiB，余量为 HTML、图标和上报等。
- 页面已加载 `static.cloudflareinsights.com` beacon，`/cdn-cgi/rum` 返回 204，说明真实用户采集脚本在当前页面工作。没有读取 Cloudflare 后台的历史聚合数据，因此真实 INP、地区/机型 P75 尚未给出。[Cloudflare Web Analytics 指标](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)
- 一次桌面 Lighthouse 无障碍评分为 93，主要未通过项是 `index.html` 的 `user-scalable=no` 禁止缩放；这是附带检查，不是本次速度分数下降的原因。
- Lighthouse 对第三方 beacon 的一天缓存只估算约 4 KiB 节省，FCP/LCP 收益为 0；CSS 阻塞对 FCP 估算 150 ms、对 LCP 为 0。二者均不排在上述问题之前。

## 原始证据

原始报告、trace、检测脚本保存在本机 `log/`，按项目约定不提交 Git；本文可独立阅读。

- [Lighthouse 桌面第 2 次 HTML 报告](../log/performance-2026-09-27/lighthouse-desktop-2.html)
- [Lighthouse 手机第 3 次 HTML 报告](../log/performance-2026-09-27/lighthouse-mobile-3.html)
- [六轮 Lighthouse 指标](../log/performance-2026-09-27/lighthouse-summary.json)
- [加载/帧时/网络原始数据](../log/performance-2026-09-27/browser-results.json)
- [开局音频对照数据](../log/performance-2026-09-27/start-interaction.json)
- [硬件和浏览器环境](../log/performance-2026-09-27/environment.json)
- [汇总 JSON](../log/performance-2026-09-27/summary.json)

真实性能边界：未覆盖 Android/iPhone 真机、Safari、不同国内运营商、长时间温升、后台 Cloudflare 真实用户聚合指标。后续优化应以相同条件复测，再以真机补充验证。

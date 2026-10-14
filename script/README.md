# 浏览器检查脚本

安装依赖并启动开发或预览服务，在另一个终端运行：

```bash
npx playwright install chromium
npm run smoke
node script/performance-regression.mjs
```

| 脚本 | 检查内容 | 输出 |
| --- | --- | --- |
| `smoke.mjs` | 桌面和手机视口的开始、动作、暂停、重开、布局与页面错误 | `log/desktop-*.png`、`log/mobile-*.png` |
| `performance-regression.mjs` | 静止不持续绘制、缩放重绘、暂停恢复、单帧回调与音频播放 | `log/performance-regression.json` |

手机视口模拟使用运行脚本的机器和 GPU，不代表手机真机性能。软件 WebGL 环境可能较慢，超时需结合页面错误、实际距离和渲染环境判断。

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `NAI_RUN_URL` | 待检查服务地址 | `http://127.0.0.1:5173/` |
| `NAI_RUN_BROWSER_CHANNEL` | 系统浏览器，例如 `chrome` | 未设置，使用 Playwright Chromium |
| `NAI_RUN_BROWSER_PATH` | 浏览器可执行文件绝对路径，优先于 channel | 未设置 |

Linux / macOS 示例：

```bash
NAI_RUN_URL=http://127.0.0.1:4173/ npm run smoke
NAI_RUN_BROWSER_CHANNEL=chrome npm run smoke
```

PowerShell 示例：

```powershell
$env:NAI_RUN_URL = 'http://127.0.0.1:4173/'
$env:NAI_RUN_BROWSER_CHANNEL = 'chrome'
npm run smoke
```

`log/` 默认不提交；分享报告前检查 URL、请求头、浏览器环境和个人路径。

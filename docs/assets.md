# 素材与第三方说明

角色名称为「奶娃」。2026-10-14，项目所有者确认现有角色素材具有公开分发授权。该确认用于仓库公开分发，不代表素材也采用 MIT，或自动授权第三方商用、修改及再分发；需要这些用途时请向维护者确认具体范围。

## 素材清单

| 路径 / 内容 | 用途 | 来源与授权状态 |
| --- | --- | --- |
| `res/review.png` | 开始页角色图片，构建包含此文件 | 所有者已确认公开分发授权；来源链接和许可凭证未随仓库提供 |
| `res/failed.png`、`idle.png`、`jumping.png`、`look-directions.png` | 角色动作 / 方向参考 | 同上 |
| `res/running.png`、`running-left.png`、`running-right.png` | 奔跑参考 | 同上 |
| `res/waiting.png`、`waving.png` | 待机 / 挥手参考 | 同上 |
| `res/spritesheet.webp`、`web-spritesheet.png` | 精灵图参考 | 同上 |
| `src/game/Player.ts` | 程序化 3D 角色与动作 | 项目代码；所参考角色形象的权利仍需单独核对 |
| `src/game/World.ts` | 程序化街景、障碍和道具 | 代码生成，没有外部模型或纹理 |
| `src/game/Sound.ts` | 程序生成音效 | 没有外部音频素材文件 |
| `public/favicon.svg` | 站点图标 | 项目内 SVG，无独立素材许可记录 |

没有打包的 `res/` 文件仍会随源码仓库公开。程序化建模也不自动消除角色形象的第三方权利问题。

后续建议补充来源链接或创作记录、作者 / 权利人、许可依据、分发 / 修改 / 商用范围，以及必要署名和限制。新增素材应逐项记录授权；需要从 Git 历史移除文件时，只删除最新文件不足以清除历史。

## 第三方依赖

运行时依赖为 Three.js（MIT）。开发依赖包括 Vite（MIT）、TypeScript（Apache-2.0）、Vitest（MIT）、Playwright（Apache-2.0）、Wrangler（MIT / Apache-2.0 双许可）。完整传递依赖由 `package-lock.json` 锁定，具体许可和版权以各包内 `LICENSE` / `NOTICE` 为准。

文档中的参考链接不表示复制了其代码，也不自动授予素材使用权。发布包含第三方代码的构建产物时，需保留各许可证要求的版权与许可声明。

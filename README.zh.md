<div align="center">

# dsh-show-media

**在当前 DeepSeek Harness 对话卡片里展示本地图片或短视频。**

[English](README.md) · [MIT](LICENSE) · [安全说明](SECURITY.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh.bundle](https://img.shields.io/badge/dsh.bundle-required-0f766e.svg)](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish.html)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-111827.svg)](https://github.com/topics/dsh-plugin)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 社区插件，不是 DeepSeek 官方产品。

对话 markdown 不会渲染本地 `file://` / Windows 路径。模型识图仍走官方 `read_image`。这个插件是给人看的。

## 安装

从 GitHub 装（无构建步骤，`lib/` 就是源码）：

```sh
dsh plugin --profile desktop add github:NecromanAlbert/dsh-show-media
```

或本地目录：

```sh
dsh plugin --profile desktop add /path/to/dsh-show-media
```

装完重启 Desktop GUI。然后让 Agent 展示本地文件。

进 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 后市场会收录。npm 可选，不影响收录。

## 做什么

| | |
| --- | --- |
| 工具 | `dsh_show_media` · 参数只有 `file_path` |
| 图片 | PNG、JPEG、WebP、GIF |
| 视频 | MP4、WebM、MOV、M4V、MKV · 单文件 64MiB |
| 显示 | 原文件字节，不走官方附件压缩 |
| 预览 | 点图片（或视频外框）· Esc / 点空白 / × 关闭 |
| 范围 | 只挂在当前对话卡 · 不占 `shell.overlay` |

相对路径按会话工作区解析。

```json
{ "file_path": "C:\\path\\to\\photo.webp" }
```

## 不是什么

- 不是 `read_image` 的替代品。
- 不是进程级浮动浮层。
- 不是第二套图库。只自定义 `dsh_show_media` 这一张工具卡。

## 开发

```sh
node --test
```

Host：`lib/index.js`（`defineTool` + `/dsh-show-media` RPC）。  
Client：`lib/client.js`（`window.__ModuleLoader__`，按工具名占 `tool.call.toolview`）。  
共享：`lib/media.js`。

## 许可

MIT。

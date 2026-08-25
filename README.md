<div align="center">

# dsh-show-media

**Show a local image or short video in the current DeepSeek Harness conversation card.**

[简体中文](README.zh.md) · [MIT](LICENSE) · [Security](SECURITY.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![dsh.bundle](https://img.shields.io/badge/dsh.bundle-required-0f766e.svg)](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish.html)
[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-111827.svg)](https://github.com/topics/dsh-plugin)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

</div>

> Community plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Not an official DeepSeek AI product.

Conversation markdown still will not render a local `file://` or Windows path. Official [`read_image`](https://github.com/deepseek-ai/deepseek-harness) remains the model-vision path. This plugin is for the human sitting at the card.

## Install

From a clone (no build step — `lib/` is the source):

```sh
dsh plugin --profile desktop add github:NecromanAlbert/dsh-show-media
```

Or a local checkout:

```sh
dsh plugin --profile desktop add /path/to/dsh-show-media
```

Restart the Desktop GUI after install. Then ask the agent to show a local file.

Listed on [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) once the catalog PR merges. npm is optional and not required for listing.

## What it does

| | |
| --- | --- |
| Tool | `dsh_show_media` · one argument `file_path` |
| Images | PNG, JPEG, WebP, GIF |
| Videos | MP4, WebM, MOV, M4V, MKV · 64MiB cap |
| Display | original file bytes, not the official attachment downsample |
| Preview | click the image (or the video frame) · Esc / backdrop / × closes |
| Scope | this conversation card only · does not occupy `shell.overlay` |

Relative paths resolve against the session workspace.

```json
{ "file_path": "C:\\path\\to\\photo.webp" }
```

## What this is not

- Not a replacement for `read_image`.
- Not a process-wide floating overlay.
- Not a second gallery. It only customizes the `dsh_show_media` tool card.

## Develop

```sh
node --test
```

Host: `lib/index.js` (`defineTool` + `/dsh-show-media` RPC).  
Client: `lib/client.js` (`window.__ModuleLoader__`, keyed `tool.call.toolview`).  
Shared: `lib/media.js`.

## License

MIT.

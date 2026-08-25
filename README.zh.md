# dsh-show-media

在当前 DeepSeek Harness 对话卡片里展示本地图片或短视频，点击后接近全屏预览。

这是给人看的。模型识图仍走官方 `read_image`。对话 markdown 不会渲染本地 `file://` / Windows 路径。

## 安装

```sh
dsh plugin --profile desktop add dsh-show-media
```

或从本地目录：

```sh
dsh plugin --profile desktop add /path/to/dsh-show-media
```

安装后重启 Desktop GUI。

## 做什么

- Agent 工具：`dsh_show_media`，参数只有 `file_path`。
- 图片：PNG、JPEG、WebP、GIF。
- 视频：MP4、WebM、MOV、M4V、MKV（单文件 64MiB）。
- 卡片按原文件字节显示。官方 `saveImage` 只给图片做会话日志附件。
- 点图片（或视频外框）放大预览。Esc / 点空白 / × 关闭。
- 预览挂在对话卡片上，不占 `shell.overlay`，不串到别的会话页。

## Agent 用法

让 Agent 展示本地文件。它应调用：

```json
{ "file_path": "C:\\path\\to\\photo.webp" }
```

相对路径按会话工作区解析。

## 不是什么

- 不是 `read_image` 的替代品。
- 不是进程级浮动浮层。
- 不是第二套图库。只自定义 `dsh_show_media` 这一张工具卡。

## 许可

MIT。

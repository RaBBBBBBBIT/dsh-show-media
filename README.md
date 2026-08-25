# dsh-show-media

Show a local image or a short local video inside the current DeepSeek Harness conversation card, then click for a near-fullscreen preview.

This is for the human. Official `read_image` remains the model-vision path. Conversation markdown still does not render local `file://` / Windows paths.

## Install

```sh
dsh plugin --profile desktop add dsh-show-media
```

Or from a clone:

```sh
dsh plugin --profile desktop add /path/to/dsh-show-media
```

Restart the Desktop GUI after install.

## What it does

- Agent tool: `dsh_show_media` with one argument, `file_path`.
- Images: PNG, JPEG, WebP, GIF.
- Videos: MP4, WebM, MOV, M4V, MKV (64MiB cap).
- The card loads the original file bytes for display. Official `saveImage` is only used as a log attachment for images.
- Click the image (or the video frame) for a larger preview. Esc / backdrop / × closes it.
- Preview is scoped to the conversation card. It does not occupy `shell.overlay` and does not pin media onto other session tabs.

## Agent usage

Ask the agent to show a local file. It should call:

```json
{ "file_path": "C:\\path\\to\\photo.webp" }
```

Relative paths resolve against the session workspace.

## What this is not

- Not a replacement for `read_image`.
- Not a process-wide floating overlay.
- Not a second gallery. It only customizes the `dsh_show_media` tool card.

## License

MIT.

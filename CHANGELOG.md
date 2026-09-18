# Changelog

## 0.1.1

- Fix loading on newer DSH Cordis runtimes by declaring the `webServer`
  service required by the Connection RPC registrar.
- Read the optional `systemPrompt` service through `ctx.get()` instead of
  direct property access, avoiding the Cordis inject guard failure.
- Publish the maintained fork under `RaBBBBBBBIT/dsh-show-media`.

## 0.1.0

- Add `dsh_show_media` for local PNG/JPEG/WebP/GIF images and MP4/WebM/MOV/M4V/MKV videos.
- Conversation card loads original file bytes for display.
- Click-to-preview uses a conversation-scoped lightbox, not `shell.overlay`.
- Official `read_image` stays the model-vision path.

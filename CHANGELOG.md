# Changelog

## 0.1.5

- Remove rounded corners from the full-size "Preview original" image and video
  lightbox while keeping the conversation-card thumbnail styling unchanged.

## 0.1.4

- Declare the namespaced `remote.session` client injection, matching DSH's
  official Remote consumers. Declaring only the parent `remote` service is not
  sufficient for Cordis property access.

## 0.1.3

- Declare the client `remote` injection required by the session-attachment
  preview path, preventing Cordis from rejecting `remote.session` at runtime.

## 0.1.2

- Read image attachments through the authenticated session RPC directly, so
  cards still render after reconnects, history reloads, or browser-use child
  sessions where an in-memory session binding is unavailable.
- Keep the bound-session reader as a compatibility fallback.

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
